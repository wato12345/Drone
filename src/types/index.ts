export type LngLat = [number, number]

export type PickMode = 'start' | 'end' | null

export interface PathMetrics {
  distanceKm: number
  avgAltitudeM: number
  noiseLevel: '低' | '中' | '高'
  windResistance: number
  buildingAvoidance: number
  estimatedTimeMin: number
}

export type PathClearanceStatus = 'safe' | 'violation' | 'critical'

export interface PathClearanceSegment {
  status: PathClearanceStatus
  coordinates: LngLat[]
}

export interface PlannedPath {
  id: 'shortest' | 'optimized'
  label: string
  color: string
  coordinates: LngLat[]
  altitudes: number[]
  buildingClearances?: number[]
  segments?: PathClearanceSegment[]
  metrics: PathMetrics
}

export interface BuildingFeature {
  type: 'Feature'
  properties: { height: number; name: string }
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
}
