/**
 * Dify-style workflow catalog.
 * Chat shows only the nodes that actually run, using these titles.
 * Add a tool here when a new agent tool should appear in the process trace.
 */
export const AGENT_WORKFLOW = {
  name: '飞行助手',
  nodes: {
    start: { type: 'start', title: '开始' },
    llm: { type: 'llm', title: '编排' },
    resolve_place: { type: 'tool', title: '解析地点' },
    get_weather: { type: 'tool', title: '查询风速' },
    check_airspace: { type: 'tool', title: '检查空域' },
    plan_route: { type: 'tool', title: '规划航线' },
    answer: { type: 'answer', title: '回复' },
  },
}

export function describeWorkflowNode(key) {
  return AGENT_WORKFLOW.nodes[key] ?? { type: 'tool', title: key }
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
