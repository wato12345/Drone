/**
 * Dify-style workflow catalog.
 * Chat shows the nodes that actually run, plus every branch those nodes can take.
 * Add a tool here when a new agent tool should appear in the process trace.
 */
export const AGENT_WORKFLOW = {
  name: '飞行助手',
  nodes: {
    start: { type: 'start', title: '开始' },
    llm: {
      type: 'llm',
      title: '编排',
      branches: [
        { id: 'resolve_place', label: '解析地点' },
        { id: 'get_weather', label: '查询风速' },
        { id: 'check_airspace', label: '检查空域' },
        { id: 'plan_route', label: '规划航线' },
        { id: 'answer', label: '直接回复' },
      ],
    },
    resolve_place: {
      type: 'tool',
      title: '解析地点',
      enabled: true,
      branches: [
        { id: 'ok', label: '已解析' },
        { id: 'error', label: '未知地点', terminal: true },
      ],
    },
    get_weather: {
      type: 'tool',
      title: '查询风速',
      enabled: true,
      branches: [
        { id: 'fly', label: '适飞' },
        { id: 'nofly', label: '不能飞', terminal: true },
        { id: 'error', label: '查询失败', terminal: true },
      ],
    },
    check_airspace: {
      type: 'tool',
      title: '检查空域',
      enabled: true,
      branches: [
        { id: 'open', label: '空域开放' },
        { id: 'closed', label: '空域关闭', terminal: true },
        { id: 'error', label: '检查失败', terminal: true },
      ],
    },
    plan_route: {
      type: 'tool',
      title: '规划航线',
      enabled: true,
      branches: [
        { id: 'ok', label: '已规划' },
        { id: 'error', label: '规划失败', terminal: true },
      ],
    },
    answer: { type: 'answer', title: '回复' },
  },
}

const TOOL_KEYS = ['resolve_place', 'get_weather', 'check_airspace', 'plan_route']

const TOOL_FACTS = {
  resolve_place: '地名→坐标；不认识返回 error「未知地点」，禁止猜坐标',
  get_weather: '返回风速 windSpeed 与 canFly（风速 < 40 km/h 为 true，40 km/h 及以上不能飞）；坐标非法返回 error',
  check_airspace: '返回 closed；不查天气',
  plan_route: '返回 distance、time、coordinates；avoidBuildings=true 时只要绕开高楼的那条',
}

export function describeWorkflowNode(key, workflow = AGENT_WORKFLOW) {
  return workflow?.nodes?.[key] ?? AGENT_WORKFLOW.nodes[key] ?? { type: 'tool', title: key }
}

export function normalizeWorkflow(input) {
  const workflow = structuredClone(AGENT_WORKFLOW)
  if (!input || typeof input !== 'object') return workflow

  if (typeof input.name === 'string' && input.name.trim()) {
    workflow.name = input.name.trim().slice(0, 40)
  }

  const nodes = input.nodes
  if (!nodes || typeof nodes !== 'object') return workflow

  for (const key of Object.keys(workflow.nodes)) {
    const incoming = nodes[key]
    if (!incoming || typeof incoming !== 'object') continue
    if (typeof incoming.title === 'string' && incoming.title.trim()) {
      workflow.nodes[key].title = incoming.title.trim().slice(0, 24)
    }
    if (TOOL_KEYS.includes(key)) {
      workflow.nodes[key].enabled = incoming.enabled !== false
    }
    if (!Array.isArray(workflow.nodes[key].branches) || !Array.isArray(incoming.branches)) continue
    for (const branch of workflow.nodes[key].branches) {
      const next = incoming.branches.find((item) => item && item.id === branch.id)
      if (!next) continue
      if (typeof next.label === 'string' && next.label.trim()) {
        branch.label = next.label.trim().slice(0, 16)
      }
      if (key !== 'llm' && typeof next.terminal === 'boolean') {
        branch.terminal = next.terminal
      }
    }
  }

  for (const branch of workflow.nodes.llm.branches) {
    if (branch.id !== 'answer' && workflow.nodes[branch.id]) {
      branch.label = workflow.nodes[branch.id].title
    }
  }

  return workflow
}

export function isToolEnabled(workflow, key) {
  return workflow?.nodes?.[key]?.enabled !== false
}

export function visibleBranches(workflow, key) {
  const branches = workflow?.nodes?.[key]?.branches
  if (!Array.isArray(branches)) return undefined
  if (key !== 'llm') return branches
  return branches.filter((branch) => branch.id === 'answer' || isToolEnabled(workflow, branch.id))
}

export function findWorkflowBranch(workflow, nodeKey, branchId) {
  if (typeof branchId !== 'string') return null
  return visibleBranches(workflow, nodeKey)?.find((branch) => branch.id === branchId) ?? null
}

export function buildSystemPrompt(workflowInput) {
  const workflow = normalizeWorkflow(workflowInput)
  const enabled = TOOL_KEYS.filter((key) => isToolEnabled(workflow, key))
  const toolLines = enabled.map(
    (key, index) => `${index + 1}. ${key} — ${workflow.nodes[key].title}：${TOOL_FACTS[key]}`,
  )
  const branchLines = enabled.flatMap((key) =>
    workflow.nodes[key].branches.map((branch) => {
      const next = branch.terminal ? '停止并回复，不要再调用工具' : '回到编排，再决定下一步'
      return `- ${workflow.nodes[key].title} / ${branch.label}：${next}`
    }),
  )
  const routeSteps = [
    enabled.includes('get_weather') ? '先 get_weather（起点）' : '',
    enabled.includes('check_airspace') ? '再 check_airspace' : '',
    enabled.includes('plan_route') ? '最后 plan_route' : '',
  ].filter(Boolean)
  const disabled = TOOL_KEYS.filter((key) => !isToolEnabled(workflow, key))
  const routeLine = routeSteps.length
    ? `直接用当前起点和终点。${routeSteps.join('；')}。每一步都按下面的分支走向决定是停止还是继续。`
    : '直接说明当前工作流没有启用航线相关工具。'

  return `你是无人机飞行助手「${workflow.name}」。你可以通过工具获取事实，再回答用户。

可用工具（每个只做一件事）：
${toolLines.join('\n') || '（当前没有启用工具，直接回复）'}

编排规则（由你根据上一步工具结果决定下一步，不要当成写死脚本机械执行）：
- 用户消息里会附带当前地图的起点和终点坐标。用户没有另外指定新地点时，直接用这些坐标，不要再 resolve_place。
- 用户只问风/风速/天气适飞：${enabled.includes('get_weather') ? '只用起点坐标调用 get_weather，然后按该节点的分支走向处理。' : '直接说明当前工作流没有启用查询风速。'}
- 用户要路线/怎么飞：${routeLine}
- 只有用户明确说出新的地名（且不是当前已给的起点/终点名称）时，才 resolve_place，再用解析出的坐标替换对应端点。
- 用户要求「起飞 / 现在起飞 / take off」：不要调用任何工具，直接回复不能起飞。
- 已关闭的工具不要调用${disabled.length ? `：${disabled.join('、')}` : '。'}
- 分支走向：
${branchLines.join('\n')}
- 回答简洁，用中文 Markdown（可用加粗和列表），不要把 Markdown 源码当纯文本堆砌。
- 用户消息之前可能附带更早的对话。请接着上下文回答；用户没有重新提出路线、天气或起飞时，不要重复执行已经完成的工具。`
}

function toolFailed(result) {
  return (
    !result ||
    typeof result !== 'object' ||
    (typeof result.error === 'string' && result.error) ||
    result.ok === false
  )
}

/** Which catalog branch a finished tool node took. */
export function pickWorkflowBranch(key, result) {
  if (key === 'get_weather') {
    if (toolFailed(result)) return 'error'
    if (result.canFly === true) return 'fly'
    if (result.canFly === false) return 'nofly'
    return 'error'
  }
  if (key === 'check_airspace') {
    if (toolFailed(result) || typeof result.closed !== 'boolean') return 'error'
    return result.closed ? 'closed' : 'open'
  }
  if (key === 'resolve_place') return toolFailed(result) || result.ok !== true ? 'error' : 'ok'
  if (key === 'plan_route') return toolFailed(result) ? 'error' : 'ok'
  return null
}

/** Orchestrator branch: the next tool, or a direct reply when no tool is called. */
export function pickLlmBranch(toolNames) {
  const names = [...new Set((toolNames ?? []).filter((name) => typeof name === 'string' && name))]
  if (!names.length) return 'answer'
  return names.length === 1 ? names[0] : names
}

export function summarizeToolResult(tool, result) {
  if (!result || typeof result !== 'object') return ''
  if (typeof result.error === 'string' && result.error) return result.error
  if (result.ok === false && typeof result.error === 'string') return result.error

  if (tool === 'resolve_place') {
    return result.ok ? `${result.name} · ${result.lng}, ${result.lat}` : '未知地点'
  }
  if (tool === 'get_weather') {
    const wind = result.windSpeed
    const fly = result.canFly ? '适飞' : '不能飞'
    return Number.isFinite(wind) ? `${wind} km/h · ${fly}` : fly
  }
  if (tool === 'check_airspace') {
    if (typeof result.closed !== 'boolean') return ''
    return result.closed ? '空域关闭' : '空域开放'
  }
  if (tool === 'plan_route') {
    const distance = result.distance
    const time = result.time
    const points = Array.isArray(result.coordinates) ? result.coordinates.length : 0
    const bits = []
    if (Number.isFinite(distance)) bits.push(`${distance} km`)
    if (Number.isFinite(time)) bits.push(`${time} min`)
    if (points) bits.push(`${points} 个航点`)
    return bits.join(' · ')
  }
  return ''
}
