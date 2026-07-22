import { haversineKm } from './geo.js'

export function pointInPolygon(point, ring) {
  const [x, y] = point
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }

  return inside
}

function pointToSegmentDistanceMeters(point, a, b) {
  const latMid = (a[1] + b[1]) / 2
  const cosLat = Math.cos((latMid * Math.PI) / 180)
  const ax = a[0] * cosLat
  const ay = a[1]
  const bx = b[0] * cosLat
  const by = b[1]
  const px = point[0] * cosLat
  const py = point[1]

  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))

  const closestLng = (ax + t * dx) / cosLat
  const closestLat = ay + t * dy
  return haversineKm(point, [closestLng, closestLat]) * 1000
}

export function pointToPolygonDistanceMeters(point, ring) {
  if (ring.length < 3) return Infinity
  if (pointInPolygon(point, ring)) return 0

  let minDist = Infinity
  for (let i = 0; i < ring.length - 1; i++) {
    const dist = pointToSegmentDistanceMeters(point, ring[i], ring[i + 1])
    if (dist < minDist) minDist = dist
  }

  return minDist
}

export function isPointNearBuilding(point, buildings, clearanceM) {
  for (const building of buildings) {
    const ring = building.geometry.coordinates[0]
    if (pointToPolygonDistanceMeters(point, ring) < clearanceM) {
      return true
    }
  }
  return false
}
