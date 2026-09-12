import { useCallback, useEffect, useState } from 'react'
import { fetchPlan } from '../api/planner'
import type { BuildingFeature, LngLat, PickMode, PlannedPath } from '../types'
import { randomNearbyPoint } from '../utils/geo'
import { getCurrentLngLat, LocationError } from '../utils/geolocation'
import { DEFAULT_END, DEFAULT_START } from '../utils/pathPlanner'

export function usePathPlanner() {
  const [start, setStart] = useState<LngLat>(DEFAULT_START)
  const [end, setEnd] = useState<LngLat>(DEFAULT_END)
  const [pickMode, setPickMode] = useState<PickMode>(null)
  const [paths, setPaths] = useState<PlannedPath[]>([])
  const [buildings, setBuildings] = useState<BuildingFeature[]>([])
  const [isPlanning, setIsPlanning] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyUserLocation = useCallback((lngLat: LngLat) => {
    setStart(lngLat)
    setEnd(randomNearbyPoint(lngLat))
    setPaths([])
    setBuildings([])
    setPickMode(null)
    setError(null)
  }, [])

  const locateMe = useCallback(async () => {
    setIsLocating(true)
    setError(null)

    try {
      const lngLat = await getCurrentLngLat()
      applyUserLocation(lngLat)
    } catch (err) {
      setError(err instanceof LocationError || err instanceof Error ? err.message : '定位失败，请手动选点')
    } finally {
      setIsLocating(false)
    }
  }, [applyUserLocation])

  useEffect(() => {
    let cancelled = false

    const autoLocate = async () => {
      setIsLocating(true)
      try {
        const lngLat = await getCurrentLngLat()
        if (!cancelled) applyUserLocation(lngLat)
      } catch {
        // Keep demo coordinates when auto-locate fails; the user can retry via the button.
      } finally {
        if (!cancelled) setIsLocating(false)
      }
    }

    void autoLocate()
    return () => {
      cancelled = true
    }
  }, [applyUserLocation])

  const handleMapClick = useCallback(
    (lngLat: LngLat) => {
      if (pickMode === 'start') {
        setStart(lngLat)
        setPickMode(null)
      } else if (pickMode === 'end') {
        setEnd(lngLat)
        setPickMode(null)
      }
    },
    [pickMode],
  )

  const planPaths = useCallback(async () => {
    setIsPlanning(true)
    setError(null)
    try {
      const result = await fetchPlan(start, end)
      setBuildings(result.buildings)
      setPaths(result.paths)
    } catch (err) {
      setError(err instanceof Error ? err.message : '路径规划失败')
      setPaths([])
      setBuildings([])
    } finally {
      setIsPlanning(false)
    }
  }, [start, end])

  const clearAll = useCallback(() => {
    setPaths([])
    setBuildings([])
    setPickMode(null)
    setError(null)
  }, [])

  const resetDemo = useCallback(() => {
    setStart(DEFAULT_START)
    setEnd(DEFAULT_END)
    setPaths([])
    setBuildings([])
    setPickMode(null)
    setError(null)
  }, [])

  return {
    start,
    end,
    pickMode,
    paths,
    buildings,
    isPlanning,
    isLocating,
    error,
    setPickMode,
    handleMapClick,
    planPaths,
    clearAll,
    resetDemo,
    locateMe,
  }
}
