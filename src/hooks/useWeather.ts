import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchWeather } from '../api/weather'
import type { WeatherData } from '../api/weather'
import type { LngLat } from '../types'
import {
  getConditionMeta,
  type WeatherCondition,
} from '../utils/weatherCodes'

const REFRESH_INTERVAL_MS = 10 * 60 * 1000

function readPreviewFromHash(): WeatherCondition | null {
  const match = window.location.hash.match(/preview=(\w+)/)
  if (!match) return null
  const meta = getConditionMeta(match[1] as WeatherCondition)
  return meta.condition === match[1] ? (match[1] as WeatherCondition) : null
}

export function useWeather(location: LngLat, enabled = true) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLayer, setShowLayer] = useState(true)
  const [previewCondition, setPreviewCondition] = useState<WeatherCondition | null>(
    readPreviewFromHash,
  )

  const displayWeather = useMemo(() => {
    if (!weather || !previewCondition) return weather
    const meta = getConditionMeta(previewCondition)
    return {
      ...weather,
      condition: meta.condition,
      label: meta.label,
      icon: meta.icon,
    }
  }, [weather, previewCondition])

  const setPreview = useCallback((condition: WeatherCondition | null) => {
    setPreviewCondition(condition)
    if (condition) {
      window.location.hash = `preview=${condition}`
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!enabled) return

    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchWeather(location[1], location[0])
      setWeather(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weather')
    } finally {
      setIsLoading(false)
    }
  }, [location, enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!enabled) return

    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [refresh, enabled])

  return {
    weather,
    displayWeather,
    isLoading,
    error,
    showLayer,
    previewCondition,
    setShowLayer,
    setPreviewCondition: setPreview,
    refresh,
  }
}
