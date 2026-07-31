import type { LngLat } from '../types'

type LocalPoint = { x: number; y: number }

function toLocal(origin: LngLat, point: LngLat): LocalPoint {
  const latRad = (origin[1] * Math.PI) / 180
  const metersPerDegLng = 111_320 * Math.max(Math.cos(latRad), 0.2)
  return {
    x: (point[0] - origin[0]) * metersPerDegLng,
    y: (point[1] - origin[1]) * 111_320,
  }
}

function toLngLat(origin: LngLat, point: LocalPoint): LngLat {
  const latRad = (origin[1] * Math.PI) / 180
  const metersPerDegLng = 111_320 * Math.max(Math.cos(latRad), 0.2)
  return [origin[0] + point.x / metersPerDegLng, origin[1] + point.y / 111_320]
}

function densifyPath(coords: LngLat[], stepM: number): LngLat[] {
  if (coords.length === 0) return []
  if (coords.length === 1) return coords

  const origin = coords[0]
  const result: LngLat[] = [coords[0]]

  for (let i = 1; i < coords.length; i++) {
    const a = toLocal(origin, coords[i - 1])
    const b = toLocal(origin, coords[i])
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    const segments = Math.max(1, Math.ceil(dist / stepM))
    for (let s = 1; s <= segments; s++) {
      const t = s / segments
      result.push(
        toLngLat(origin, {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        }),
      )
    }
  }

  return result
}

function cross(o: LocalPoint, a: LocalPoint, b: LocalPoint) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

/** Monotone-chain convex hull; returns CCW ring without repeating first point. */
function convexHull(points: LocalPoint[]): LocalPoint[] {
  if (points.length <= 1) return points.slice()

  const sorted = points
    .slice()
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))

  const lower: LocalPoint[] = []
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop()
    }
    lower.push(point)
  }

  const upper: LocalPoint[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop()
    }
    upper.push(point)
  }

  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

/**
 * One solid noise footprint: densify the route, sample circle boundaries,
 * then take their convex hull so the shade is a single filled region
 * (the outer envelope the user sketched).
 */
export function pathNoiseBufferPolygon(pathCoordinates: LngLat[], radiusM: number): LngLat[] | null {
  if (radiusM <= 0 || pathCoordinates.length === 0) return null

  const origin = pathCoordinates[0]
  const samples = densifyPath(pathCoordinates, Math.max(radiusM * 0.35, 8))
  const boundary: LocalPoint[] = []
  const circleSteps = 24

  for (const sample of samples) {
    const center = toLocal(origin, sample)
    for (let i = 0; i < circleSteps; i++) {
      const angle = (i / circleSteps) * Math.PI * 2
      boundary.push({
        x: center.x + Math.cos(angle) * radiusM,
        y: center.y + Math.sin(angle) * radiusM,
      })
    }
  }

  const hull = convexHull(boundary)
  if (hull.length < 3) return null

  const ring = hull.map((point) => toLngLat(origin, point))
  ring.push([...ring[0]] as LngLat)
  return ring
}

export function buildNoiseRangeFeatures(
  pathCoordinates: LngLat[],
  radiusM: number,
  color: string,
  pathId: string,
) {
  const ring = pathNoiseBufferPolygon(pathCoordinates, radiusM)
  if (!ring) return []

  return [
    {
      type: 'Feature' as const,
      properties: { color, pathId },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [ring],
      },
    },
  ]
}
