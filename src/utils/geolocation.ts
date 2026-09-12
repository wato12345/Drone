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
  unsupported: '当前浏览器不支持定位，请手动在地图上选点',
  insecure: '定位需要 HTTPS 或 localhost。当前页面不是安全上下文，请改用 localhost 访问或手动选点',
  denied: '定位被拒绝，请在浏览器地址栏允许获取位置，或手动选点',
  unavailable: '无法获取位置。请确认系统定位服务已开启，或手动在地图上选点',
  timeout: '定位超时。请检查定位权限后重试，或手动选点',
  unknown: '定位失败，请手动选点',
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
