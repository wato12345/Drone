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
  { condition: 'sunny', label: 'Clear', icon: '☀️' },
  { condition: 'partly-cloudy', label: 'Partly cloudy', icon: '⛅' },
  { condition: 'cloudy', label: 'Overcast', icon: '☁️' },
  { condition: 'rain', label: 'Rain', icon: '🌧️' },
  { condition: 'snow', label: 'Snow', icon: '❄️' },
  { condition: 'fog', label: 'Fog', icon: '🌫️' },
  { condition: 'thunder', label: 'Thunderstorm', icon: '⛈️' },
]

export function getConditionMeta(condition: WeatherCondition): WeatherConditionMeta {
  return (
    WEATHER_PREVIEW_OPTIONS.find((item) => item.condition === condition) ?? {
      condition: 'cloudy',
      label: 'Overcast',
      icon: '☁️',
    }
  )
}

/** WMO weather interpretation codes (Open-Meteo) */
export function weatherCodeToCondition(code: number): WeatherConditionMeta {
  if (code === 0) {
    return { condition: 'sunny', label: 'Clear', icon: '☀️' }
  }
  if (code === 1 || code === 2) {
    return { condition: 'partly-cloudy', label: 'Partly cloudy', icon: '⛅' }
  }
  if (code === 3) {
    return { condition: 'cloudy', label: 'Overcast', icon: '☁️' }
  }
  if (code === 45 || code === 48) {
    return { condition: 'fog', label: 'Fog', icon: '🌫️' }
  }
  if (code >= 51 && code <= 67) {
    return { condition: 'rain', label: 'Rain', icon: '🌧️' }
  }
  if (code >= 71 && code <= 77) {
    return { condition: 'snow', label: 'Snow', icon: '❄️' }
  }
  if (code >= 80 && code <= 82) {
    return { condition: 'rain', label: 'Showers', icon: '🌦️' }
  }
  if (code >= 85 && code <= 86) {
    return { condition: 'snow', label: 'Snow showers', icon: '🌨️' }
  }
  if (code >= 95) {
    return { condition: 'thunder', label: 'Thunderstorm', icon: '⛈️' }
  }
  return { condition: 'cloudy', label: 'Overcast', icon: '☁️' }
}
