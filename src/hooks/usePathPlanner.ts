import { useCallback, useState } from 'react'
import { fetchPlan } from '../api/planner'
import { useBuildingAvoidance } from '../context/BuildingAvoidanceContext'
import { useFlightSettings } from '../context/FlightSettingsContext'
import type { BuildingFeature, LngLat, PickMode, PlannedPath } from '../types'
import type { DroneModel } from '../data/droneModels'
import { randomNearbyPoint } from '../utils/geo'
import { DEFAULT_END, DEFAULT_START } from '../utils/pathPlanner'

export function usePathPlanner() {
  const { enabled: avoidBuildings, clearanceM } = useBuildingAvoidance()
  const { cruiseAltitudeM, noiseRangeM, droneModelId, showNoiseRange, droneModel } =
    useFlightSettings()
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
      setStart(DEFAULT_START)
      setEnd(DEFAULT_END)
      setPaths([])
      setBuildings([])
      setBuildingCount(0)
      setPickMode(null)
      setError(null)
      setPlanWarning('Location unavailable on this device — using Midtown Manhattan demo points.')
      return
    }

    setIsLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyUserLocation(position.coords.longitude, position.coords.latitude)
        setPlanWarning(null)
        setIsLocating(false)
      },
      () => {
        setIsLocating(false)
        setStart(DEFAULT_START)
        setEnd(DEFAULT_END)
        setPaths([])
        setBuildings([])
        setBuildingCount(0)
        setPickMode(null)
        setError(null)
        setPlanWarning('Location unavailable on this device — using Midtown Manhattan demo points.')
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
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
    setPlanWarning(null)
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      const result = await fetchPlan(start, end, {
        avoidBuildings,
        clearanceM,
        cruiseAltitudeM,
        noiseRangeM,
        droneModelId,
      })
      setPaths(result.paths)
      setBuildings(result.buildings ?? [])
      setBuildingCount(result.buildingCount ?? result.buildings?.length ?? 0)
      setPlanWarning(result.buildingWarning ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Path planning failed')
      setPaths([])
      setBuildings([])
      setBuildingCount(0)
      setPlanWarning(null)
    } finally {
      setIsPlanning(false)
    }
  }, [start, end, avoidBuildings, clearanceM, cruiseAltitudeM, noiseRangeM, droneModelId])

  const clearAll = useCallback(() => {
    setPaths([])
    setBuildings([])
    setBuildingCount(0)
    setPickMode(null)
    setError(null)
  }, [])

  const resetDemo = useCallback(() => {
    setStart(DEFAULT_START)
    setEnd(DEFAULT_END)
    setPaths([])
    setBuildings([])
    setBuildingCount(0)
    setPickMode(null)
    setError(null)
    setPlanWarning(null)
  }, [])

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
    cruiseAltitudeM,
    noiseRangeM,
    showNoiseRange,
    droneModel: droneModel as DroneModel,
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
