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
