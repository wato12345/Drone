import { useCallback, useEffect, useState } from 'react'
import { fetchPlan } from '../api/planner'
import { useBuildingAvoidance } from '../context/BuildingAvoidanceContext'
import type { BuildingFeature, LngLat, PickMode, PlannedPath } from '../types'
import { randomNearbyPoint } from '../utils/geo'
import { DEFAULT_END, DEFAULT_START } from '../utils/pathPlanner'

export function usePathPlanner() {
  const { enabled: avoidBuildings, clearanceM } = useBuildingAvoidance()
  const [start, setStart] = useState<LngLat>(DEFAULT_START)
  const [end, setEnd] = useState<LngLat>(DEFAULT_END)
  const [pickMode, setPickMode] = useState<PickMode>(null)
  const [paths, setPaths] = useState<PlannedPath[]>([])
  const [buildings, setBuildings] = useState<BuildingFeature[]>([])
  const [buildingCount, setBuildingCount] = useState(0)
  const [planWarning, setPlanWarning] = useState<string | null>(null)
  const [isPlanning, setIsPlanning] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyUserLocation = useCallback((lng: number, lat: number) => {
    const userStart: LngLat = [lng, lat]
    setStart(userStart)
    setEnd(randomNearbyPoint(userStart))
    setPaths([])
    setBuildings([])
    setBuildingCount(0)
    setPickMode(null)
    setError(null)
  }, [])

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setError('当前浏览器不支持定位')
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyUserLocation(position.coords.longitude, position.coords.latitude)
        setIsLocating(false)
      },
      (err) => {
        setIsLocating(false)
        if (err.code === err.PERMISSION_DENIED) {
          setError('定位被拒绝，请允许浏览器获取位置或手动选点')
        } else {
          setError('定位失败，请手动选点')
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [applyUserLocation])

  useEffect(() => {
    locateMe()
  }, [locateMe])

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
    setPlanWarning(null)
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      const result = await fetchPlan(start, end, { avoidBuildings, clearanceM })
      setPaths(result.paths)
      setBuildings(result.buildings ?? [])
      setBuildingCount(result.buildingCount ?? result.buildings?.length ?? 0)
      setPlanWarning(result.buildingWarning ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '路径规划失败')
      setPaths([])
      setBuildings([])
      setBuildingCount(0)
      setPlanWarning(null)
    } finally {
      setIsPlanning(false)
    }
  }, [start, end, avoidBuildings, clearanceM])

  const clearAll = useCallback(() => {
    setPaths([])
    setBuildings([])
    setBuildingCount(0)
    setPickMode(null)
    setError(null)
  }, [])

  const resetDemo = useCallback(() => {
    locateMe()
  }, [locateMe])

  return {
    start,
    end,
    pickMode,
    paths,
    buildings,
    buildingCount,
    planWarning,
    avoidBuildings,
    clearanceM,
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
