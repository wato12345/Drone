import type { LngLat } from '../types'

const EARTH_RADIUS_KM = 6371

export function haversineKm(a: LngLat, b: LngLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export function pathLengthKm(coords: LngLat[]): number {
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    total += haversineKm(coords[i - 1], coords[i])
  }
  return total
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function interpolateLngLat(a: LngLat, b: LngLat, t: number): LngLat {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
}

export function randomNearbyPoint(
  center: LngLat,
  minKm = 0.4,
  maxKm = 1.2,
): LngLat {
  const angle = Math.random() * 2 * Math.PI
  const distKm = minKm + Math.random() * (maxKm - minKm)
  const latRad = (center[1] * Math.PI) / 180
  const dLat = (distKm / EARTH_RADIUS_KM) * (180 / Math.PI)
  const dLng = dLat / Math.cos(latRad)
  return [
    center[0] + dLng * Math.cos(angle),
    center[1] + dLat * Math.sin(angle),
  ]
}

export function bboxFromPoints(points: LngLat[], padding = 0.004): {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
} {
  const lngs = points.map((p) => p[0])
  const lats = points.map((p) => p[1])
  return {
    minLng: Math.min(...lngs) - padding,
    maxLng: Math.max(...lngs) + padding,
    minLat: Math.min(...lats) - padding,
    maxLat: Math.max(...lats) + padding,
  }
}
