import { moonshotChat } from './moonshot.js'
import {
  AGENT_TOOL_DEFINITIONS,
  executeAgentTool,
  extractToolError,
} from './agentTools.js'

const MAX_TOOL_STEPS = 5

const SYSTEM_PROMPT = `你是无人机飞行助手。你可以通过工具获取事实，再回答用户。

可用工具（每个只做一件事）：
1. resolve_place(name) — 地名→坐标；不认识返回 error「未知地点」，禁止猜坐标
2. get_weather(lng, lat) — 返回风速 windSpeed 与 canFly（风速<10 为 true）；坐标非法返回 error
3. check_airspace(startLng, startLat, endLng, endLat) — 返回 closed；不查天气
4. plan_route(startLng, startLat, endLng, endLat, avoidBuildings) — 返回 distance、time、coordinates；avoidBuildings=true 时只要绕开高楼的那条

编排规则（由你根据上一步工具结果决定下一步，不要当成写死脚本机械执行）：
- 用户只问风/风速/天气适飞：只调用 get_weather（若缺坐标可先 resolve_place）
- 用户要路线/怎么飞：先 resolve_place（起终点），再 get_weather；若 canFly 为 false 则停止并说明不能飞；再 check_airspace，若 closed 为 true 则停止并说明空域关闭；最后才 plan_route
- 用户要求「起飞 / 现在起飞 / take off」：不要调用任何工具，直接回复不能起飞
- 工具结果含 error 或 ok:false：把 error 原文告诉用户，不要改写、不要继续瞎猜
- 回答简洁，用中文；汇报工具得到的核心数字即可

上下文里可能附带当前地图起点坐标，可直接用于 get_weather，无需重复解析。`

function parseToolArgs(raw) {
  if (raw == null || raw === '') return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function buildUserContent({ message, lat, lng, placeName }) {
  const parts = [message || '']
  if (placeName) parts.push(`当前地点名称：${placeName}`)
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    parts.push(`当前地图起点坐标：lng=${lng}, lat=${lat}`)
  }
  return parts.filter(Boolean).join('\n')
}

/**
 * Model-driven agent loop with tool calling (max 5 tool steps).
 * Not a hardcoded pipeline — the model chooses tools from prior results.
 */
export async function runDroneAgent({ message, lat, lng, placeName }) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserContent({ message, lat, lng, placeName }) },
  ]

  const steps = []
  let model = null
  let lastUsage = null

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    const result = await moonshotChat({
      messages,
      tools: AGENT_TOOL_DEFINITIONS,
      toolChoice: 'auto',
      responseFormat: 'text',
    })

    model = result.model
    lastUsage = result.usage

    if (!result.toolCalls.length) {
      return {
        ok: true,
        reply: result.content || '完成。',
        steps,
        model,
        usage: lastUsage,
      }
    }

    // Append the full assistant message (required for tool_calls continuity)
    messages.push({
      role: 'assistant',
      content: result.message.content ?? null,
      tool_calls: result.toolCalls,
    })

    for (const toolCall of result.toolCalls) {
      const name = toolCall?.function?.name
      const args = parseToolArgs(toolCall?.function?.arguments)
      const toolResult = await executeAgentTool(name, args)
      const toolError = extractToolError(toolResult)

      steps.push({
        tool: name,
        args,
        result: toolResult,
      })

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name,
        content: JSON.stringify(toolResult),
      })

      // On tool failure: surface error as-is (within ≤5 steps)
      if (toolError) {
        return {
          ok: false,
          reply: toolError,
          error: toolError,
          steps,
          model,
          usage: lastUsage,
        }
      }
    }
  }

  // Hit max steps while still requesting tools — ask model for a final text reply without tools
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

  return {
    ok: true,
    reply: final.content || '步骤已达上限，请简化问题后重试。',
    steps,
    model: final.model ?? model,
    usage: final.usage ?? lastUsage,
    truncated: true,
  }
}
