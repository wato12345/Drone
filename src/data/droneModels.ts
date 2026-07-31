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
    name: '轻型测绘 Mini',
    description: '小型多旋翼，噪音较小，适合短途城市巡检',
    cruiseAltitudeM: 50,
    noiseRangeM: 60,
    cruiseSpeedKmh: 40,
  },
  {
    id: 'mavic-pro',
    name: '航拍 Pro',
    description: '主流消费级航拍机，均衡续航与噪音',
    cruiseAltitudeM: 70,
    noiseRangeM: 100,
    cruiseSpeedKmh: 48,
  },
  {
    id: 'matrice-30',
    name: '行业 Matrice',
    description: '中型行业机，载荷更大，噪音 footprint 更广',
    cruiseAltitudeM: 90,
    noiseRangeM: 160,
    cruiseSpeedKmh: 55,
  },
  {
    id: 'heavy-lift',
    name: '重载物流机',
    description: '重载多旋翼，巡航更高，噪音影响范围最大',
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
