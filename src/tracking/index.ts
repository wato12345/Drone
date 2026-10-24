const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'
const SITE = 'drone'
const ACTOR_KEY = 'drone-track-actor'

const SHOW_LAYER_EVENT = `${SITE}.planner.weather.show-layer`
const HIDE_LAYER_EVENT = `${SITE}.planner.weather.hide-layer`

export interface ClickPreference {
  showEvent: string
  hideEvent: string
  showClicks: number
  hideClicks: number
  showPeople: number
  hidePeople: number
  defaultPosition: string
}

function createActorId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `anon${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export function initTracking() {
  if (typeof window === 'undefined') return
  if (!window.localStorage.getItem(ACTOR_KEY)) {
    window.localStorage.setItem(ACTOR_KEY, createActorId())
  }
}

function actorId() {
  initTracking()
  return window.localStorage.getItem(ACTOR_KEY) ?? createActorId()
}

/** Report a click as site.page.module.position. */
export function trackClick(page: string, module: string, position: string) {
  const event = `${SITE}.${page}.${module}.${position}`
  const body = JSON.stringify({ event, actorId: actorId() })

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' })
    if (navigator.sendBeacon(`${API_BASE}/track`, blob)) return
  }

  void fetch(`${API_BASE}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Tracking must not interrupt the click.
  })
}

export async function fetchWeatherLayerPreference(): Promise<ClickPreference | null> {
  const params = new URLSearchParams({
    showEvent: SHOW_LAYER_EVENT,
    hideEvent: HIDE_LAYER_EVENT,
  })
  try {
    const response = await fetch(`${API_BASE}/track/preference?${params}`)
    if (!response.ok) return null
    return (await response.json()) as ClickPreference
  } catch {
    return null
  }
}

export function trackWeatherLayerToggle(nextVisible: boolean) {
  trackClick('planner', 'weather', nextVisible ? 'show-layer' : 'hide-layer')
}
