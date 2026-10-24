import { moonshotChat } from './moonshot.js'
import {
  AGENT_TOOL_DEFINITIONS,
  executeAgentTool,
  extractToolError,
} from './agentTools.js'
import {
  buildSystemPrompt,
  describeWorkflowNode,
  findWorkflowBranch,
  isToolEnabled,
  normalizeWorkflow,
  pickLlmBranch,
  pickWorkflowBranch,
  summarizeToolResult,
  visibleBranches,
} from './agentWorkflow.js'

const MAX_TOOL_STEPS = 5

function parseToolArgs(raw) {
  if (raw == null || raw === '') return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function formatPoint(label, lng, lat, name) {
  const hasCoord = Number.isFinite(lng) && Number.isFinite(lat)
  if (!hasCoord && !name) return null
  const bits = []
  if (name) bits.push(name)
  if (hasCoord) bits.push(`lng=${lng}, lat=${lat}`)
  return `${label}：${bits.join('，')}`
}

function buildUserContent({
  message,
  lat,
  lng,
  placeName,
  endLat,
  endLng,
  endPlaceName,
}) {
  const parts = [message || '']
  const startLine = formatPoint('当前地图起点', lng, lat, placeName)
  const endLine = formatPoint('当前地图终点', endLng, endLat, endPlaceName)
  if (startLine) parts.push(startLine)
  if (endLine) parts.push(endLine)
  if (startLine || endLine) {
    parts.push('以上是地图上的当前起终点。未另外指定地点时，直接使用这些坐标。')
  }
  return parts.filter(Boolean).join('\n')
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return []
  return history
    .filter(
      (item) =>
        item &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.trim(),
    )
    .slice(-12)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 2000),
    }))
}

function createWorkflowEmitter(onEvent, workflowDef) {
  let seq = 0
  const startedAt = Date.now()

  const emit = (event, data) => {
    onEvent?.({ event, ...data, elapsedMs: Date.now() - startedAt })
  }

  const openNode = (key) => {
    const meta = describeWorkflowNode(key, workflowDef)
    const id = `${key}-${++seq}`
    const started = Date.now()
    const branches = visibleBranches(workflowDef, key)
    emit('node_started', {
      id,
      nodeType: meta.type,
      title: meta.title,
      tool: meta.type === 'tool' ? key : undefined,
      status: 'running',
      ...(branches ? { branches } : {}),
    })
    return {
      finish(status, extra = {}) {
        const branch =
          extra.branch != null
            ? extra.branch
            : extra.result
              ? pickWorkflowBranch(key, extra.result)
              : null
        emit('node_finished', {
          id,
          nodeType: meta.type,
          title: meta.title,
          tool: meta.type === 'tool' ? key : undefined,
          status,
          nodeElapsedMs: Date.now() - started,
          ...(branches ? { branches } : {}),
          ...extra,
          ...(branch != null ? { branch } : {}),
        })
      },
    }
  }

  return { emit, openNode, startedAt }
}

/**
 * Model-driven agent loop with tool calling (max 5 tool steps).
 * Not a hardcoded pipeline — the model chooses tools from prior results.
 * Optional onEvent streams Dify-style node_started / node_finished updates.
 */
export async function runDroneAgent({
  message,
  lat,
  lng,
  placeName,
  endLat,
  endLng,
  endPlaceName,
  history = [],
  workflow: workflowInput,
  onEvent,
}) {
  const workflowDef = normalizeWorkflow(workflowInput)
  const enabledTools = AGENT_TOOL_DEFINITIONS.filter((tool) =>
    isToolEnabled(workflowDef, tool.function.name),
  )
  const prior = normalizeHistory(history)
  const messages = [
    { role: 'system', content: buildSystemPrompt(workflowDef) },
    ...prior,
    {
      role: 'user',
      content: buildUserContent({ message, lat, lng, placeName, endLat, endLng, endPlaceName }),
    },
  ]

  const steps = []
  let model = null
  let lastUsage = null
  let activeNode = null
  const trace = createWorkflowEmitter(onEvent, workflowDef)

  trace.emit('workflow_started', { status: 'running' })
  const startNode = trace.openNode('start')
  startNode.finish('succeeded', { detail: '已接收问题' })

  const finishWorkflow = (payload) => {
    trace.emit('workflow_finished', payload)
    return payload
  }

  try {
    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      const llmNode = trace.openNode('llm')
      activeNode = llmNode
      const result = await moonshotChat({
        messages,
        tools: enabledTools,
        toolChoice: 'auto',
        responseFormat: 'text',
      })

      model = result.model
      lastUsage = result.usage

      if (!result.toolCalls.length) {
        llmNode.finish('succeeded', { detail: '生成回复', branch: 'answer' })
        activeNode = null
        const answerNode = trace.openNode('answer')
        const reply = result.content || '完成。'
        answerNode.finish('succeeded')
        return finishWorkflow({
          ok: true,
          reply,
          steps,
          model,
          usage: lastUsage,
          status: 'succeeded',
        })
      }

      const nextNames = result.toolCalls
        .map((call) => call?.function?.name)
        .filter((name) => typeof name === 'string' && name)
      const nextTools = nextNames.map((name) => describeWorkflowNode(name, workflowDef).title).filter(Boolean)
      llmNode.finish('succeeded', {
        detail: nextTools.length ? `下一步：${nextTools.join('、')}` : '调用工具',
        branch: pickLlmBranch(nextNames),
      })
      activeNode = null

      messages.push({
        role: 'assistant',
        content: result.message.content ?? null,
        tool_calls: result.toolCalls,
      })

      for (const toolCall of result.toolCalls) {
        const name = toolCall?.function?.name
        const args = parseToolArgs(toolCall?.function?.arguments)
        const toolNode = trace.openNode(name || 'tool')
        activeNode = toolNode
        const toolResult =
          name && workflowDef.nodes[name]?.enabled === false
            ? { error: '工具已关闭' }
            : await executeAgentTool(name, args)
        const toolError = extractToolError(toolResult)
        const branchId = pickWorkflowBranch(name, toolResult)
        const branchMeta = findWorkflowBranch(workflowDef, name, branchId)
        const stop = branchMeta ? branchMeta.terminal === true : Boolean(toolError)

        steps.push({
          tool: name,
          args,
          result: toolResult,
        })

        toolNode.finish(toolError ? 'failed' : 'succeeded', {
          detail: summarizeToolResult(name, toolResult),
          args,
          result: toolResult,
        })
        activeNode = null

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(toolResult),
        })

        if (stop) {
          let reply = toolError || branchMeta?.label || '已停止'
          let ok = !toolError
          if (!toolError) {
            const final = await moonshotChat({
              messages: [
                ...messages,
                {
                  role: 'user',
                  content: `分支「${branchMeta?.label ?? ''}」配置为停止。请用一两句中文说明这个结果，不要再调用工具。`,
                },
              ],
              responseFormat: 'text',
            })
            reply = final.content || reply
            model = final.model ?? model
            lastUsage = final.usage ?? lastUsage
          }
          const answerNode = trace.openNode('answer')
          answerNode.finish(ok ? 'succeeded' : 'failed', { detail: toolError || branchMeta?.label })
          return finishWorkflow({
            ok,
            reply,
            error: toolError || null,
            steps,
            model,
            usage: lastUsage,
            status: ok ? 'succeeded' : 'failed',
          })
        }
      }
    }

    const llmNode = trace.openNode('llm')
    activeNode = llmNode
    const final = await moonshotChat({
      messages: [
        ...messages,
        {
          role: 'user',
          content: '已达到工具调用上限。请根据已有结果，用一两句话给出最终答复；若有 error 请原样转告。',
        },
      ],
      responseFormat: 'text',
    })
    llmNode.finish('succeeded', { detail: '生成回复', branch: 'answer' })
    activeNode = null
    const answerNode = trace.openNode('answer')
    const reply = final.content || '步骤已达上限，请简化问题后重试。'
    answerNode.finish('succeeded')

    return finishWorkflow({
      ok: true,
      reply,
      steps,
      model: final.model ?? model,
      usage: final.usage ?? lastUsage,
      truncated: true,
      status: 'succeeded',
    })
  } catch (err) {
    const messageText = err instanceof Error ? err.message : 'Agent request failed'
    activeNode?.finish('failed', { detail: messageText })
    activeNode = null
    trace.emit('workflow_finished', {
      ok: false,
      reply: messageText,
      error: messageText,
      steps,
      model,
      usage: lastUsage,
      status: 'failed',
    })
    throw err
  }
}
