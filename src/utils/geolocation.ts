import type { LngLat } from '../types'

export type LocationErrorCode =
  | 'unsupported'
  | 'insecure'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unknown'

export class LocationError extends Error {
  code: LocationErrorCode

  constructor(code: LocationErrorCode, message: string) {
    super(message)
    this.name = 'LocationError'
    this.code = code
  }
}

const GEO_ERROR_MESSAGES: Record<LocationErrorCode, string> = {
  unsupported: 'This browser does not support location. Pick a start point on the map instead.',
  insecure: 'Location requires HTTPS or localhost. Open this site over HTTPS, or pick a start point on the map.',
  denied: 'Location permission was denied. Allow location in the address bar, or pick a start point on the map.',
  unavailable: 'Could not read your position. Turn on system location services, or pick a start point on the map.',
  timeout: 'Location timed out. Check location permission and try again, or pick a start point on the map.',
  unknown: 'Could not get your location. Pick a start point on the map instead.',
}

function toLocationError(err: unknown): LocationError {
  if (err instanceof LocationError) return err

  const code = typeof err === 'object' && err && 'code' in err ? Number(err.code) : NaN
  if (code === 1) return new LocationError('denied', GEO_ERROR_MESSAGES.denied)
  if (code === 2) return new LocationError('unavailable', GEO_ERROR_MESSAGES.unavailable)
  if (code === 3) return new LocationError('timeout', GEO_ERROR_MESSAGES.timeout)
  return new LocationError('unknown', GEO_ERROR_MESSAGES.unknown)
}

function requestBrowserPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

async function getBrowserLngLat(): Promise<LngLat> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new LocationError('unsupported', GEO_ERROR_MESSAGES.unsupported)
  }

  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new LocationError('insecure', GEO_ERROR_MESSAGES.insecure)
  }

  const attempts: PositionOptions[] = [
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  ]

  let lastError: unknown
  for (const options of attempts) {
    try {
      const position = await requestBrowserPosition(options)
      return [position.coords.longitude, position.coords.latitude]
    } catch (err) {
      lastError = err
      const mapped = toLocationError(err)
      if (mapped.code === 'denied') throw mapped
    }
  }

  throw toLocationError(lastError)
}

function parseCoord(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as Record<string, unknown>
  } finally {
    window.clearTimeout(timer)
  }
}

async function getIpLngLat(): Promise<LngLat | null> {
  const sources: Array<() => Promise<LngLat | null>> = [
    async () => {
      const data = await fetchJson('https://get.geojs.io/v1/ip/geo.json')
      const lng = parseCoord(data.longitude)
      const lat = parseCoord(data.latitude)
      return lng !== null && lat !== null ? [lng, lat] : null
    },
    async () => {
      const data = await fetchJson('https://ipwho.is/')
      if (data.success === false) return null
      const lng = parseCoord(data.longitude)
      const lat = parseCoord(data.latitude)
      return lng !== null && lat !== null ? [lng, lat] : null
    },
  ]

  for (const source of sources) {
    try {
      const point = await source()
      if (point) return point
    } catch {
      // try next public IP fallback
    }
  }

  return null
}

export async function getCurrentLngLat(): Promise<LngLat> {
  try {
    return await getBrowserLngLat()
  } catch (err) {
    const mapped = toLocationError(err)
    if (mapped.code === 'denied') throw mapped

    const ipPoint = await getIpLngLat()
    if (ipPoint) return ipPoint

    throw mapped
  }
}
