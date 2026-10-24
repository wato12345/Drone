import type { WorkflowDefinition } from './workflow'

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

export interface AirspaceRestriction {
  type?: string
  title?: string
  description?: string
  advice?: string
  sourceHint?: string
}

export interface AirspaceResult {
  locationName?: string | null
  canFly?: boolean | null
  canFlyLabel?: string
  riskLevel?: string
  airspaceType?: string
  permitRequired?: boolean
  documents?: string[]
  summary?: string
  restrictions?: AirspaceRestriction[]
  checklist?: string[]
  disclaimer?: string
}

export interface AgentAirspaceResponse {
  ok: boolean
  intent: string
  confidence: number
  reason?: string
  airspace: AirspaceResult | null
  model?: string | null
  location?: {
    lat: number | null
    lng: number | null
    placeName: string | null
  }
  error?: string
}

export interface AgentAirspaceRequest {
  lat?: number
  lng?: number
  placeName?: string
  message?: string
  forceAirspace?: boolean
}

export interface AgentChatRequest {
  message: string
  lat?: number
  lng?: number
  placeName?: string
  startLat?: number
  startLng?: number
  startPlaceName?: string
  endLat?: number
  endLng?: number
  endPlaceName?: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  workflow?: WorkflowDefinition
}

export interface AgentRouteResult {
  distance?: number | null
  time?: number | null
  coordinates?: [number, number][]
  altitudes?: number[]
  avoidBuildings?: boolean
  metrics?: {
    distanceKm: number
    avgAltitudeM: number
    maxAltitudeM?: number
    totalClimbM?: number
    is3D?: boolean
    noiseLevel: 'Low' | 'Medium' | 'High'
    windResistance: number
    buildingAvoidance: number
    estimatedTimeMin: number
  } | null
  error?: string
}

export interface AgentChatStep {
  tool: string
  args: Record<string, unknown>
  result: AgentRouteResult | Record<string, unknown>
}

export interface AgentChatResponse {
  ok: boolean
  reply: string
  error?: string | null
  steps?: AgentChatStep[]
  model?: string | null
  truncated?: boolean
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Request failed'
    throw new Error(message)
  }
  return data as T
}

export async function queryAirspaceAgent(
  body: AgentAirspaceRequest,
): Promise<AgentAirspaceResponse> {
  const response = await fetch(`${API_BASE}/agent/airspace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseJson<AgentAirspaceResponse>(response)
}

export interface WorkflowBranch {
  id: string
  label: string
  terminal?: boolean
}

export interface WorkflowNodeState {
  id: string
  nodeType: string
  title: string
  status: 'running' | 'succeeded' | 'failed'
  tool?: string
  detail?: string
  nodeElapsedMs?: number
  branches?: WorkflowBranch[]
  branch?: string | string[]
  result?: AgentRouteResult | Record<string, unknown>
}

export interface WorkflowStreamEvent {
  event: string
  id?: string
  nodeType?: string
  title?: string
  status?: string
  tool?: string
  detail?: string
  nodeElapsedMs?: number
  elapsedMs?: number
  branches?: WorkflowBranch[]
  branch?: string | string[]
  ok?: boolean
  reply?: string
  error?: string | null
  result?: AgentRouteResult | Record<string, unknown>
  steps?: AgentChatStep[]
}

export async function streamAgentChat(
  body: AgentChatRequest,
  onEvent: (event: WorkflowStreamEvent) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE}/agent/chat/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    let message = 'Request failed'
    try {
      const data = await response.json()
      if (typeof data?.error === 'string') message = data.error
    } catch {
      // non-JSON error page
    }
    throw new Error(message)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const flush = (chunk: string) => {
    const lines = chunk.split('\n')
    let eventName = 'message'
    const dataLines: string[] = []
    for (const line of lines) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (!dataLines.length) return
    const data = JSON.parse(dataLines.join('\n')) as Omit<WorkflowStreamEvent, 'event'>
    onEvent({ event: eventName, ...data })
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      if (part.trim()) flush(part)
    }
  }
  if (buffer.trim()) flush(buffer)
}

export interface StoredAgentMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  nodes?: WorkflowNodeState[]
  workflowStatus?: 'succeeded' | 'failed'
  elapsedMs?: number
}

export async function fetchAgentHistory(): Promise<StoredAgentMessage[]> {
  const response = await fetch(`${API_BASE}/agent/history`, {
    credentials: 'include',
  })
  if (response.status === 401) return []
  const data = await response.json()
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Failed to load chat history'
    throw new Error(message)
  }
  return Array.isArray(data.messages) ? data.messages : []
}

export async function saveAgentHistory(messages: StoredAgentMessage[]): Promise<void> {
  const response = await fetch(`${API_BASE}/agent/history`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Failed to save chat history'
    throw new Error(message)
  }
}
