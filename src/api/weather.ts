import { weatherCodeToCondition } from '../utils/weatherCodes'
import type { WeatherCondition } from '../utils/weatherCodes'

export interface WeatherData {
  temperature: number
  humidity: number
  windSpeed: number
  isDay: boolean
  weatherCode: number
  condition: WeatherCondition
  label: string
  icon: string
  updatedAt: Date
}

interface OpenMeteoCurrent {
  time: string
  temperature_2m: number
  relative_humidity_2m: number
  wind_speed_10m: number
  weather_code: number
  is_day: number
}

interface OpenMeteoResponse {
  current: OpenMeteoCurrent
}

export async function fetchWeather(lat: number, lng: number): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day',
    timezone: 'auto',
  })

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!response.ok) {
    throw new Error('Failed to fetch weather data')
  }

  const data = (await response.json()) as OpenMeteoResponse
  const { current } = data
  const meta = weatherCodeToCondition(current.weather_code)

  return {
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    isDay: current.is_day === 1,
    weatherCode: current.weather_code,
    condition: meta.condition,
    label: meta.label,
    icon: meta.icon,
    updatedAt: new Date(current.time),
  }
}
