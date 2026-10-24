const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'
export const WORKFLOW_STORAGE_KEY = 'drone-workflow-v1'

export interface WorkflowBranchDef {
  id: string
  label: string
  terminal?: boolean
}

export interface WorkflowNodeDef {
  type: string
  title: string
  enabled?: boolean
  branches?: WorkflowBranchDef[]
}

export interface WorkflowDefinition {
  name: string
  nodes: Record<string, WorkflowNodeDef>
}

export interface WorkflowResponse {
  workflow: WorkflowDefinition
  saved: boolean
}

export function readStoredWorkflow(): WorkflowDefinition | null {
  try {
    const raw = localStorage.getItem(WORKFLOW_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorkflowDefinition
    if (!parsed || typeof parsed !== 'object' || !parsed.nodes) return null
    return parsed
  } catch {
    return null
  }
}

export function writeStoredWorkflow(workflow: WorkflowDefinition) {
  localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(workflow))
}

export async function fetchWorkflow(options?: { fresh?: boolean }): Promise<WorkflowResponse> {
  const query = options?.fresh ? '?default=1' : ''
  const response = await fetch(`${API_BASE}/agent/workflow${query}`, { credentials: 'include' })
  const data = await response.json()
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Failed to load workflow'
    throw new Error(message)
  }
  return data as WorkflowResponse
}

export async function saveWorkflow(workflow: WorkflowDefinition): Promise<WorkflowResponse> {
  const response = await fetch(`${API_BASE}/agent/workflow`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflow }),
  })
  const data = await response.json()
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Failed to save workflow'
    throw new Error(message)
  }
  return data as WorkflowResponse
}
