import type { AuthResponse, AuthUser } from '../types/auth'

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Request failed'
    throw new Error(message)
  }
  return data as T
}

const fetchOptions: RequestInit = {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
}

export async function registerUser(input: {
  username: string
  password: string
  email?: string
}): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    ...fetchOptions,
    method: 'POST',
    body: JSON.stringify(input),
  })
  const data = await parseJson<AuthResponse>(response)
  return data.user
}

export async function loginUser(input: {
  username: string
  password: string
}): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    ...fetchOptions,
    method: 'POST',
    body: JSON.stringify(input),
  })
  const data = await parseJson<AuthResponse>(response)
  return data.user
}

export async function logoutUser(): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    ...fetchOptions,
    method: 'POST',
  })
  await parseJson<{ ok: boolean }>(response)
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE}/auth/me`, {
    credentials: 'include',
  })
  if (response.status === 401) return null
  const data = await parseJson<AuthResponse>(response)
  return data.user
}
