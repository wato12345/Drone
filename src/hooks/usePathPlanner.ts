import { useCallback, useEffect, useState } from 'react'
import { fetchPlan } from '../api/planner'
import { useBuildingAvoidance } from '../context/BuildingAvoidanceContext'
import { useFlightSettings } from '../context/FlightSettingsContext'
import type { AgentRouteResult } from '../api/agent'
import type { BuildingFeature, LngLat, PickMode, PlannedPath } from '../types'
import type { DroneModel } from '../data/droneModels'
import { randomNearbyPoint } from '../utils/geo'
import { getCurrentLngLat, LocationError } from '../utils/geolocation'
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

  const applyUserLocation = useCallback((lngLat: LngLat, options?: { randomizeEnd?: boolean }) => {
    setStart(lngLat)
    // Only seed a random landing point on first entry — Locate me keeps the current end.
    if (options?.randomizeEnd) {
      setEnd(randomNearbyPoint(lngLat))
    }
    setPaths([])
    setBuildings([])
    setBuildingCount(0)
    setPickMode(null)
    setError(null)
    setPlanWarning(null)
  }, [])

  const locateMe = useCallback(async () => {
    setIsLocating(true)
    setError(null)

    try {
      const lngLat = await getCurrentLngLat()
      applyUserLocation(lngLat)
    } catch (err) {
      const message =
        err instanceof LocationError || err instanceof Error
          ? err.message
          : 'Could not get your location. Pick a start point on the map instead.'
      setPlanWarning(message)
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
        if (!cancelled) applyUserLocation(lngLat, { randomizeEnd: true })
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof LocationError || err instanceof Error
              ? err.message
              : 'Location unavailable — using Midtown Manhattan demo points. Tap Locate me to retry.'
          setPlanWarning(message)
        }
      } finally {
        if (!cancelled) setIsLocating(false)
      }
    }

    void autoLocate()
    return () => {
      cancelled = true
    }
  }, [applyUserLocation])

  const clearRouteState = useCallback(() => {
    setPaths([])
    setBuildings([])
    setBuildingCount(0)
    setError(null)
    setPlanWarning(null)
  }, [])

  const setStartPoint = useCallback(
    (lngLat: LngLat) => {
      setStart(lngLat)
      setPickMode(null)
      clearRouteState()
    },
    [clearRouteState],
  )

  const setEndPoint = useCallback(
    (lngLat: LngLat) => {
      setEnd(lngLat)
      setPickMode(null)
      clearRouteState()
    },
    [clearRouteState],
  )

  const handleMapClick = useCallback(
    (lngLat: LngLat) => {
      if (pickMode === 'start') {
        setStartPoint(lngLat)
      } else if (pickMode === 'end') {
        setEndPoint(lngLat)
      }
    },
    [pickMode, setStartPoint, setEndPoint],
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

  const applyAgentRoute = useCallback((route: AgentRouteResult) => {
    const coordinates = (route.coordinates ?? []).filter(
      (point): point is LngLat =>
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1]),
    )
    if (coordinates.length < 2) return

    const altitudes =
      Array.isArray(route.altitudes) && route.altitudes.length === coordinates.length
        ? route.altitudes
        : coordinates.map(() => cruiseAltitudeM)
    const metrics = route.metrics
    const avoid = route.avoidBuildings === true
    const path: PlannedPath = {
      id: avoid ? 'optimized' : 'shortest',
      label: avoid ? 'Agent route (avoid buildings)' : 'Agent route',
      color: avoid ? '#34d399' : '#38bdf8',
      coordinates,
      altitudes,
      is3D: altitudes.some((alt) => alt > 0),
      metrics: {
        distanceKm: metrics?.distanceKm ?? route.distance ?? 0,
        avgAltitudeM:
          metrics?.avgAltitudeM ??
          Math.round(altitudes.reduce((sum, alt) => sum + alt, 0) / altitudes.length),
        maxAltitudeM: metrics?.maxAltitudeM ?? Math.max(...altitudes),
        totalClimbM: metrics?.totalClimbM,
        is3D: true,
        noiseLevel: metrics?.noiseLevel ?? 'Low',
        windResistance: metrics?.windResistance ?? 0,
        buildingAvoidance: metrics?.buildingAvoidance ?? (avoid ? 100 : 0),
        estimatedTimeMin: metrics?.estimatedTimeMin ?? route.time ?? 0,
      },
    }

    setPaths([path])
    setError(null)
    setPlanWarning(null)
  }, [cruiseAltitudeM])

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
    setStartPoint,
    setEndPoint,
    handleMapClick,
    planPaths,
    applyAgentRoute,
    clearAll,
    resetDemo,
    locateMe,
  }
}
