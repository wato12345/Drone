import type { LngLat } from '../types'

const CAP_STEPS = 16

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

function simplifyPath(coords: LngLat[], minStepM = 12): LngLat[] {
  if (coords.length <= 2) return coords
  const origin = coords[0]
  const kept: LngLat[] = [coords[0]]
  let last = toLocal(origin, coords[0])

  for (let i = 1; i < coords.length - 1; i++) {
    const current = toLocal(origin, coords[i])
    const dist = Math.hypot(current.x - last.x, current.y - last.y)
    if (dist >= minStepM) {
      kept.push(coords[i])
      last = current
    }
  }

  kept.push(coords[coords.length - 1])
  return kept
}

function offsetPoint(point: LocalPoint, dx: number, dy: number, radiusM: number, sign: 1 | -1): LocalPoint {
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * radiusM * sign
  const ny = (dx / len) * radiusM * sign
  return { x: point.x + nx, y: point.y + ny }
}

function semicircle(
  center: LocalPoint,
  fromAngle: number,
  toAngle: number,
  radiusM: number,
  steps = CAP_STEPS,
): LocalPoint[] {
  const points: LocalPoint[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const angle = fromAngle + (toAngle - fromAngle) * t
    points.push({
      x: center.x + Math.cos(angle) * radiusM,
      y: center.y + Math.sin(angle) * radiusM,
    })
  }
  return points
}

/** Build one continuous stadium-like buffer around the whole path. */
export function pathNoiseBufferPolygon(pathCoordinates: LngLat[], radiusM: number): LngLat[] | null {
  if (radiusM <= 0 || pathCoordinates.length === 0) return null

  const coords = simplifyPath(pathCoordinates)
  const origin = coords[0]
  const local = coords.map((point) => toLocal(origin, point))

  if (local.length === 1) {
    return semicircle(local[0], 0, Math.PI * 2, radiusM).map((point) => toLngLat(origin, point))
  }

  const left: LocalPoint[] = []
  const right: LocalPoint[] = []

  for (let i = 0; i < local.length; i++) {
    const prev = local[Math.max(0, i - 1)]
    const next = local[Math.min(local.length - 1, i + 1)]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    left.push(offsetPoint(local[i], dx, dy, radiusM, 1))
    right.push(offsetPoint(local[i], dx, dy, radiusM, -1))
  }

  const start = local[0]
  const end = local[local.length - 1]
  const startDir = {
    x: local[1].x - start.x,
    y: local[1].y - start.y,
  }
  const endDir = {
    x: end.x - local[local.length - 2].x,
    y: end.y - local[local.length - 2].y,
  }
  const startAngle = Math.atan2(startDir.y, startDir.x)
  const endAngle = Math.atan2(endDir.y, endDir.x)

  // Left side forward, round end cap, right side backward, round start cap.
  const ringLocal = [
    ...left,
    ...semicircle(end, endAngle - Math.PI / 2, endAngle + Math.PI / 2, radiusM),
    ...right.slice().reverse(),
    ...semicircle(start, startAngle + Math.PI / 2, startAngle + (Math.PI * 3) / 2, radiusM),
  ]

  const ring = ringLocal.map((point) => toLngLat(origin, point))
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([...first] as LngLat)
  }
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
