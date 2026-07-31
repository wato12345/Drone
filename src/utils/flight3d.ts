import type { LngLat, PathClearanceStatus, PlannedPath } from '../types'

const RIBBON_HALF_WIDTH_M = 3
const TUBE_THICKNESS_M = 5
const GROUND_ALT_M = 0
const MIN_VISIBLE_TUBE_M = 2
const WALL_HALF_WIDTH_M = 1

type FlightFeature = {
  type: 'Feature'
  properties: Record<string, string | number>
  geometry:
    | { type: 'LineString'; coordinates: LngLat[] }
    | { type: 'Polygon'; coordinates: LngLat[][] }
}

type FlightFeatureCollection = {
  type: 'FeatureCollection'
  features: FlightFeature[]
}

function metersToDegOffsets(lat: number, eastM: number, northM: number): LngLat {
  const dLat = northM / 111_320
  const dLng = eastM / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2))
  return [dLng, dLat]
}

/** Thin ground polygon covering the segment a→b, used for fill-extrusion. */
export function segmentFootprint(a: LngLat, b: LngLat, halfWidthM = RIBBON_HALF_WIDTH_M): LngLat[] {
  const midLat = (a[1] + b[1]) / 2
  const east = (b[0] - a[0]) * 111_320 * Math.cos((midLat * Math.PI) / 180)
  const north = (b[1] - a[1]) * 111_320
  const len = Math.hypot(east, north) || 1
  const ux = east / len
  const uy = north / len
  const px = -uy * halfWidthM
  const py = ux * halfWidthM
  const [dLng, dLat] = metersToDegOffsets(midLat, px, py)

  return [
    [a[0] - dLng, a[1] - dLat],
    [b[0] - dLng, b[1] - dLat],
    [b[0] + dLng, b[1] + dLat],
    [a[0] + dLng, a[1] + dLat],
    [a[0] - dLng, a[1] - dLat],
  ]
}

function resolveAltitudes(path: PlannedPath): number[] {
  if (path.coordinates3d?.length === path.coordinates.length) {
    return path.coordinates3d.map((c) => c[2])
  }
  if (path.altitudes.length === path.coordinates.length) {
    return path.altitudes
  }
  return path.coordinates.map((_, i) => path.altitudes[i] ?? GROUND_ALT_M)
}

function segmentStatusAtIndex(path: PlannedPath, index: number): PathClearanceStatus {
  if (!path.segments?.length) return 'safe'
  let cursor = 0
  for (const segment of path.segments) {
    const count = segment.coordinates.length
    if (count === 0) continue
    if (index <= cursor + count - 1) return segment.status
    cursor += Math.max(count - 1, 1)
  }
  return path.segments[path.segments.length - 1]?.status ?? 'safe'
}

function statusColor(path: PlannedPath, status: PathClearanceStatus): string {
  if (status === 'violation') return '#ef4444'
  return path.color
}

export interface Flight3dCollections {
  tubes: FlightFeatureCollection
  walls: FlightFeatureCollection
  ground: FlightFeatureCollection
}

/** Build MapLibre fill-extrusion geometry so pitch/rotate reveals flight altitude. */
export function buildFlight3dCollections(paths: PlannedPath[]): Flight3dCollections {
  const tubes: FlightFeature[] = []
  const walls: FlightFeature[] = []
  const ground: FlightFeature[] = []

  paths.forEach((path) => {
    const coords = path.coordinates
    const alts = resolveAltitudes(path)
    if (coords.length < 2) return

    ground.push({
      type: 'Feature',
      properties: { color: path.color, pathId: path.id },
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
    })

    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i]
      const b = coords[i + 1]
      const altA = Math.max(alts[i] ?? GROUND_ALT_M, GROUND_ALT_M)
      const altB = Math.max(alts[i + 1] ?? GROUND_ALT_M, GROUND_ALT_M)
      const top = Math.max(altA, altB)
      const bottom = Math.min(altA, altB)
      const color = statusColor(path, segmentStatusAtIndex(path, i))
      const footprint = segmentFootprint(a, b)

      // Skip near-flat ground segments; climb/cruise segments stay extruded.
      if (top >= MIN_VISIBLE_TUBE_M) {
        const height = top
        const base = Math.max(bottom > 0 ? Math.max(bottom - 2, 0) : Math.max(height - TUBE_THICKNESS_M, 0), 0)
        tubes.push({
          type: 'Feature',
          properties: {
            color,
            height,
            base: Math.min(base, Math.max(height - 1, 0)),
            pathId: path.id,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [footprint],
          },
        })
      }

      if (top > GROUND_ALT_M) {
        walls.push({
          type: 'Feature',
          properties: {
            color,
            height: top,
            pathId: path.id,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [segmentFootprint(a, b, WALL_HALF_WIDTH_M)],
          },
        })
      }
    }
  })

  return {
    tubes: { type: 'FeatureCollection', features: tubes },
    walls: { type: 'FeatureCollection', features: walls },
    ground: { type: 'FeatureCollection', features: ground },
  }
}

export function pathHas3d(paths: PlannedPath[]): boolean {
  return paths.some(
    (path) =>
      path.is3D ||
      Boolean(path.coordinates3d?.length) ||
      path.altitudes.some((alt) => alt > GROUND_ALT_M),
  )
}
