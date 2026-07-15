import type { BuildingFeature, LngLat, PlannedPath } from '../types'

export interface PlanResponse {
  buildings: BuildingFeature[]
  paths: PlannedPath[]
}

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : '请求失败'
    throw new Error(message)
  }
  return data as T
}

export async function fetchPlan(start: LngLat, end: LngLat): Promise<PlanResponse> {
  const response = await fetch(`${API_BASE}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start, end }),
  })
  return parseJson<PlanResponse>(response)
}

export async function fetchDefaults(): Promise<{ start: LngLat; end: LngLat }> {
  const response = await fetch(`${API_BASE}/defaults`)
  return parseJson<{ start: LngLat; end: LngLat }>(response)
}

export async function fetchHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/health`)
  return parseJson<{ status: string }>(response)
}
