import type { LngLat } from '../types'

const CIRCLE_STEPS = 48

/** Approximate a geodesic circle as a lon/lat polygon ring. */
export function circlePolygon(center: LngLat, radiusM: number, steps = CIRCLE_STEPS): LngLat[] {
  const [lng, lat] = center
  const latRad = (lat * Math.PI) / 180
  const metersPerDegLat = 111_320
  const metersPerDegLng = 111_320 * Math.max(Math.cos(latRad), 0.2)
  const ring: LngLat[] = []

  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2
    const dEast = Math.cos(theta) * radiusM
    const dNorth = Math.sin(theta) * radiusM
    ring.push([lng + dEast / metersPerDegLng, lat + dNorth / metersPerDegLat])
  }

  return ring
}

export function buildNoiseRangeFeatures(
  pathCoordinates: LngLat[],
  radiusM: number,
  color: string,
  pathId: string,
) {
  if (radiusM <= 0 || pathCoordinates.length === 0) return []

  // Sample along path so long routes don't create huge feature counts.
  const stride = Math.max(1, Math.floor(pathCoordinates.length / 8))
  const samples: LngLat[] = []
  for (let i = 0; i < pathCoordinates.length; i += stride) {
    samples.push(pathCoordinates[i])
  }
  const last = pathCoordinates[pathCoordinates.length - 1]
  const prev = samples[samples.length - 1]
  if (!prev || prev[0] !== last[0] || prev[1] !== last[1]) {
    samples.push(last)
  }

  return samples.map((center, index) => ({
    type: 'Feature' as const,
    properties: { color, pathId, sample: index },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [circlePolygon(center, radiusM)],
    },
  }))
}
