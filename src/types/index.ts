export type LngLat = [number, number]

export type PickMode = 'start' | 'end' | null

export interface PathMetrics {
  distanceKm: number
  avgAltitudeM: number
  maxAltitudeM?: number
  totalClimbM?: number
  is3D?: boolean
  noiseLevel: 'Low' | 'Medium' | 'High'
  windResistance: number
  buildingAvoidance: number
  estimatedTimeMin: number
}

export type PathClearanceStatus = 'safe' | 'violation' | 'critical'

export interface PathClearanceSegment {
  status: PathClearanceStatus
  coordinates: LngLat[]
}

export type LngLatAlt = [number, number, number]

export interface PlannedPath {
  id: 'shortest' | 'optimized'
  label: string
  color: string
  coordinates: LngLat[]
  coordinates3d?: LngLatAlt[]
  altitudes: number[]
  buildingClearances?: number[]
  segments?: PathClearanceSegment[]
  is3D?: boolean
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
