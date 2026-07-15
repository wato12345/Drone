export type WeatherCondition =
  | 'sunny'
  | 'partly-cloudy'
  | 'cloudy'
  | 'rain'
  | 'snow'
  | 'fog'
  | 'thunder'

export interface WeatherConditionMeta {
  condition: WeatherCondition
  label: string
  icon: string
}

export const WEATHER_PREVIEW_OPTIONS: WeatherConditionMeta[] = [
  { condition: 'sunny', label: '晴朗', icon: '☀️' },
  { condition: 'partly-cloudy', label: '多云', icon: '⛅' },
  { condition: 'cloudy', label: '阴天', icon: '☁️' },
  { condition: 'rain', label: '下雨', icon: '🌧️' },
  { condition: 'snow', label: '下雪', icon: '❄️' },
  { condition: 'fog', label: '雾', icon: '🌫️' },
  { condition: 'thunder', label: '雷暴', icon: '⛈️' },
]

export function getConditionMeta(condition: WeatherCondition): WeatherConditionMeta {
  return (
    WEATHER_PREVIEW_OPTIONS.find((item) => item.condition === condition) ?? {
      condition: 'cloudy',
      label: '阴天',
      icon: '☁️',
    }
  )
}

/** WMO weather interpretation codes (Open-Meteo) */
export function weatherCodeToCondition(code: number): WeatherConditionMeta {
  if (code === 0) {
    return { condition: 'sunny', label: '晴朗', icon: '☀️' }
  }
  if (code === 1 || code === 2) {
    return { condition: 'partly-cloudy', label: '多云', icon: '⛅' }
  }
  if (code === 3) {
    return { condition: 'cloudy', label: '阴天', icon: '☁️' }
  }
  if (code === 45 || code === 48) {
    return { condition: 'fog', label: '雾', icon: '🌫️' }
  }
  if (code >= 51 && code <= 67) {
    return { condition: 'rain', label: '下雨', icon: '🌧️' }
  }
  if (code >= 71 && code <= 77) {
    return { condition: 'snow', label: '下雪', icon: '❄️' }
  }
  if (code >= 80 && code <= 82) {
    return { condition: 'rain', label: '阵雨', icon: '🌦️' }
  }
  if (code >= 85 && code <= 86) {
    return { condition: 'snow', label: '阵雪', icon: '🌨️' }
  }
  if (code >= 95) {
    return { condition: 'thunder', label: '雷暴', icon: '⛈️' }
  }
  return { condition: 'cloudy', label: '阴天', icon: '☁️' }
}
