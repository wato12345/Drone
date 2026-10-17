import { useEffect, useId, useRef, useState } from 'react'
import { fetchPlaceSearch, type PlaceSearchResult } from '../api/geocode'
import type { LngLat } from '../types'

type SearchTarget = 'start' | 'end'

interface MapSearchPanelProps {
  startPlaceName?: string | null
  endPlaceName?: string | null
  onSetStart: (lngLat: LngLat) => void
  onSetEnd: (lngLat: LngLat) => void
}

export function MapSearchPanel({
  startPlaceName,
  endPlaceName,
  onSetStart,
  onSetEnd,
}: MapSearchPanelProps) {
  const panelId = useId()
  const [startQuery, setStartQuery] = useState('')
  const [endQuery, setEndQuery] = useState('')
  const [active, setActive] = useState<SearchTarget | null>(null)
  const [results, setResults] = useState<PlaceSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const query = (active === 'start' ? startQuery : active === 'end' ? endQuery : '').trim()
    if (!active || query.length < 2) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    const timer = window.setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      setError(null)

      void fetchPlaceSearch(query)
        .then((items) => {
          if (controller.signal.aborted) return
          setResults(items)
          if (items.length === 0) setError('No places found')
        })
        .catch((err) => {
          if (controller.signal.aborted) return
          setResults([])
          setError(err instanceof Error ? err.message : 'Search failed')
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 320)

    return () => {
      window.clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [active, startQuery, endQuery])

  const pickResult = (target: SearchTarget, item: PlaceSearchResult) => {
    const lngLat: LngLat = [item.lng, item.lat]
    if (target === 'start') {
      onSetStart(lngLat)
      setStartQuery(item.name)
    } else {
      onSetEnd(lngLat)
      setEndQuery(item.name)
    }
    setActive(null)
    setResults([])
    setError(null)
  }

  return (
    <div className="map-search-panel" role="search" aria-label="Search start and end">
      <div className="map-search-header">
        <strong>Route points</strong>
        <span>Search to set start or landing</span>
      </div>

      <label className="map-search-field" htmlFor={`${panelId}-start`}>
        <span className="map-search-badge start">S</span>
        <div className="map-search-input-wrap">
          <input
            id={`${panelId}-start`}
            value={startQuery}
            placeholder={startPlaceName || 'Search start…'}
            autoComplete="off"
            onFocus={() => setActive('start')}
            onChange={(e) => {
              setStartQuery(e.target.value)
              setActive('start')
            }}
          />
          {active === 'start' && loading && <em className="map-search-status">Searching…</em>}
        </div>
      </label>

      <label className="map-search-field" htmlFor={`${panelId}-end`}>
        <span className="map-search-badge end">E</span>
        <div className="map-search-input-wrap">
          <input
            id={`${panelId}-end`}
            value={endQuery}
            placeholder={endPlaceName || 'Search landing…'}
            autoComplete="off"
            onFocus={() => setActive('end')}
            onChange={(e) => {
              setEndQuery(e.target.value)
              setActive('end')
            }}
          />
          {active === 'end' && loading && <em className="map-search-status">Searching…</em>}
        </div>
      </label>

      {active && (results.length > 0 || error) && (
        <ul className="map-search-results" role="listbox">
          {error && results.length === 0 ? (
            <li className="map-search-empty">{error}</li>
          ) : (
            results.map((item) => (
              <li key={`${item.lng},${item.lat},${item.displayName}`}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickResult(active, item)}>
                  <strong>{item.name}</strong>
                  <span>{item.displayName}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
