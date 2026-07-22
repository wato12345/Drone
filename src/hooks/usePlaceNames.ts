import { useEffect, useState } from 'react'
import { fetchReverseGeocode } from '../api/geocode'
import type { LngLat } from '../types'

export function usePlaceNames(start: LngLat, end: LngLat) {
  const [startName, setStartName] = useState<string | null>(null)
  const [endName, setEndName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function resolveNames() {
      setIsLoading(true)
      setStartName(null)
      setEndName(null)

      try {
        const [startResult, endResult] = await Promise.all([
          fetchReverseGeocode(start[1], start[0]),
          fetchReverseGeocode(end[1], end[0]),
        ])

        if (!cancelled) {
          setStartName(startResult.name)
          setEndName(endResult.name)
        }
      } catch {
        if (!cancelled) {
          setStartName(null)
          setEndName(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void resolveNames()

    return () => {
      cancelled = true
    }
  }, [start[0], start[1], end[0], end[1]])

  return { startName, endName, isLoading }
}
