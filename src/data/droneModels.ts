export interface DroneModel {
  id: string
  name: string
  description: string
  /** Suggested cruise altitude above ground (m) */
  cruiseAltitudeM: number
  /** Approximate ground noise footprint radius (m) */
  noiseRangeM: number
  /** Typical cruise speed for ETA estimates (km/h) */
  cruiseSpeedKmh: number
}

export const DRONE_MODELS: DroneModel[] = [
  {
    id: 'mini-se',
    name: 'Mini Surveyor',
    description: 'Compact multirotor with low noise, suited for short urban inspections',
    cruiseAltitudeM: 50,
    noiseRangeM: 60,
    cruiseSpeedKmh: 40,
  },
  {
    id: 'mavic-pro',
    name: 'Aerial Pro',
    description: 'Popular consumer aerial drone balancing range and noise',
    cruiseAltitudeM: 70,
    noiseRangeM: 100,
    cruiseSpeedKmh: 48,
  },
  {
    id: 'matrice-30',
    name: 'Matrice Enterprise',
    description: 'Mid-size enterprise drone with heavier payload and wider noise footprint',
    cruiseAltitudeM: 90,
    noiseRangeM: 160,
    cruiseSpeedKmh: 55,
  },
  {
    id: 'heavy-lift',
    name: 'Heavy-Lift Cargo',
    description: 'Heavy-lift multirotor with higher cruise altitude and the largest noise impact area',
    cruiseAltitudeM: 110,
    noiseRangeM: 220,
    cruiseSpeedKmh: 45,
  },
]

export const DEFAULT_DRONE_MODEL_ID = DRONE_MODELS[1].id

export function getDroneModel(id: string | null | undefined): DroneModel {
  return DRONE_MODELS.find((model) => model.id === id) ?? DRONE_MODELS[1]
}

export const CRUISE_ALTITUDE_MIN_M = 40
export const CRUISE_ALTITUDE_MAX_M = 150
