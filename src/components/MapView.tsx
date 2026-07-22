import { useCallback, useEffect, useMemo, useRef } from 'react'
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre'
import type { WeatherData } from '../api/weather'
import type { BuildingFeature, LngLat, PathClearanceStatus, PickMode, PlannedPath } from '../types'
import type { WeatherCondition } from '../utils/weatherCodes'
import { LoadingDots } from './LoadingDots'
import { WeatherBadge } from './WeatherBadge'
import { WeatherOverlay } from './WeatherOverlay'
import 'maplibre-gl/dist/maplibre-gl.css'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const BASE_CRUISE_M = 50

const CLEARANCE_COLORS: Record<PathClearanceStatus, string | null> = {
  safe: null,
  violation: '#ef4444',
  critical: '#eab308',
}

function coordToPillarPolygon(lng: number, lat: number, size = 0.00007): LngLat[] {
  return [
    [lng - size, lat - size],
    [lng + size, lat - size],
    [lng + size, lat + size],
    [lng - size, lat + size],
    [lng - size, lat - size],
  ]
}

function segmentColor(path: PlannedPath, status: PathClearanceStatus) {
  if (status === 'safe') return path.color
  return CLEARANCE_COLORS[status] ?? path.color
}

interface MapViewProps {
  start: LngLat
  end: LngLat
  startPlaceName: string | null
  endPlaceName: string | null
  placeNamesLoading: boolean
  pickMode: PickMode
  paths: PlannedPath[]
  buildings: BuildingFeature[]
  weather: WeatherData | null
  weatherLoading: boolean
  weatherError: string | null
  showWeatherLayer: boolean
  previewCondition: WeatherCondition | null
  onPreviewWeatherChange: (condition: WeatherCondition | null) => void
  onToggleWeatherLayer: () => void
  onRefreshWeather: () => void
  onMapClick: (lngLat: LngLat) => void
}

export function MapView({
  start,
  end,
  startPlaceName,
  endPlaceName,
  placeNamesLoading,
  pickMode,
  paths,
  buildings,
  weather,
  weatherLoading,
  weatherError,
  showWeatherLayer,
  previewCondition,
  onPreviewWeatherChange,
  onToggleWeatherLayer,
  onRefreshWeather,
  onMapClick,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null)

  const buildingCollection = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: buildings,
    }),
    [buildings],
  )

  const pathSources = useMemo(() => {
    const sources: Array<{
      id: string
      color: string
      data: {
        type: 'Feature'
        properties: { color: string }
        geometry: { type: 'LineString'; coordinates: LngLat[] }
      }
    }> = []

    paths.forEach((path) => {
      const segments = path.segments?.length
        ? path.segments
        : [{ status: 'safe' as const, coordinates: path.coordinates }]

      segments.forEach((segment, index) => {
        if (segment.coordinates.length < 2) return
        sources.push({
          id: `${path.id}-${segment.status}-${index}`,
          color: segmentColor(path, segment.status),
          data: {
            type: 'Feature',
            properties: { color: segmentColor(path, segment.status) },
            geometry: {
              type: 'LineString',
              coordinates: segment.coordinates,
            },
          },
        })
      })
    })

    return sources
  }, [paths])

  const flightPillars = useMemo(() => {
    const features: Array<{
      type: 'Feature'
      properties: { altitude: number; color: string }
      geometry: { type: 'Polygon'; coordinates: LngLat[][] }
    }> = []

    paths.forEach((path) => {
      if (!path.is3D) return
      path.coordinates.forEach((coord, index) => {
        if (index % 2 !== 0 && index !== path.coordinates.length - 1) return
        const altitude = path.altitudes[index]
        if (altitude <= BASE_CRUISE_M + 10) return
        features.push({
          type: 'Feature',
          properties: { altitude, color: path.color },
          geometry: {
            type: 'Polygon',
            coordinates: [coordToPillarPolygon(coord[0], coord[1])],
          },
        })
      })
    })

    return { type: 'FeatureCollection' as const, features }
  }, [paths])

  const fitBounds = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const points: LngLat[] = [start, end]
    paths.forEach((path) => points.push(...path.coordinates))

    if (points.length < 2) return

    const lngs = points.map((p) => p[0])
    const lats = points.map((p) => p[1])
    map.fitBounds(
      [
        [Math.min(...lngs) - 0.004, Math.min(...lats) - 0.004],
        [Math.max(...lngs) + 0.004, Math.max(...lats) + 0.004],
      ],
      { padding: 80, duration: 900 },
    )
  }, [start, end, paths])

  useEffect(() => {
    fitBounds()
  }, [fitBounds])

  const handleClick = (event: MapLayerMouseEvent) => {
    if (!pickMode) return
    onMapClick([event.lngLat.lng, event.lngLat.lat])
  }

  return (
    <div className={`map-wrapper ${pickMode ? 'picking' : ''}`}>
      {pickMode && (
        <div className="map-hint">
          {pickMode === 'start' ? '点击地图设置起点' : '点击地图设置终点'}
        </div>
      )}

      <Map
        ref={mapRef}
        initialViewState={{
          longitude: (start[0] + end[0]) / 2,
          latitude: (start[1] + end[1]) / 2,
          zoom: 14.5,
          pitch: 55,
          bearing: -18,
        }}
        mapStyle={MAP_STYLE}
        onClick={handleClick}
        style={{ width: '100%', height: '100%' }}
        cursor={pickMode ? 'crosshair' : 'grab'}
        attributionControl={false}
      >
        <NavigationControl position="top-right" visualizePitch />

        {buildings.length > 0 && (
          <Source id="avoidance-buildings" type="geojson" data={buildingCollection}>
            <Layer
              id="avoidance-building-fill"
              type="fill"
              paint={{
                'fill-color': '#f97316',
                'fill-opacity': 0.18,
              }}
            />
            <Layer
              id="avoidance-building-outline"
              type="line"
              paint={{
                'line-color': '#fb923c',
                'line-width': 1.5,
                'line-opacity': 0.75,
              }}
            />
            <Layer
              id="avoidance-building-3d"
              type="fill-extrusion"
              paint={{
                'fill-extrusion-color': '#64748b',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.72,
              }}
            />
          </Source>
        )}

        {pathSources.map((source) => (
          <Source key={source.id} id={`path-${source.id}`} type="geojson" data={source.data}>
            <Layer
              id={`path-line-${source.id}`}
              type="line"
              paint={{
                'line-color': source.color,
                'line-width': 5,
                'line-opacity': 0.92,
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
            />
          </Source>
        ))}

        {flightPillars.features.length > 0 && (
          <Source id="flight-altitude-pillars" type="geojson" data={flightPillars}>
            <Layer
              id="flight-altitude-pillars-3d"
              type="fill-extrusion"
              paint={{
                'fill-extrusion-color': ['get', 'color'],
                'fill-extrusion-height': ['get', 'altitude'],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.55,
              }}
            />
          </Source>
        )}

        <Marker longitude={start[0]} latitude={start[1]} anchor="bottom">
          <div className="map-marker map-marker-start">
            {placeNamesLoading && !startPlaceName ? (
              <LoadingDots label="解析中" className="map-marker-label loading" />
            ) : startPlaceName ? (
              <span className="map-marker-label" title={startPlaceName}>
                {startPlaceName}
              </span>
            ) : null}
            <div className="marker start-marker">起</div>
          </div>
        </Marker>
        <Marker longitude={end[0]} latitude={end[1]} anchor="bottom">
          <div className="map-marker map-marker-end">
            {placeNamesLoading && !endPlaceName ? (
              <LoadingDots label="解析中" className="map-marker-label loading" />
            ) : endPlaceName ? (
              <span className="map-marker-label" title={endPlaceName}>
                {endPlaceName}
              </span>
            ) : null}
            <div className="marker end-marker">终</div>
          </div>
        </Marker>
      </Map>

      {weather && showWeatherLayer && (
        <WeatherOverlay
          condition={weather.condition}
          isDay={weather.isDay}
          visible={showWeatherLayer}
        />
      )}

      <WeatherBadge
        weather={weather}
        isLoading={weatherLoading}
        error={weatherError}
        showLayer={showWeatherLayer}
        previewCondition={previewCondition}
        onPreviewChange={onPreviewWeatherChange}
        onToggleLayer={onToggleWeatherLayer}
        onRefresh={onRefreshWeather}
      />

      <div className="map-overlay">
        <div className="overlay-item shortest">最短路径</div>
        <div className="overlay-item optimized">智能优化路径</div>
        {paths.some((path) => path.is3D) && (
          <div className="overlay-item flight-3d">3D 爬升路径</div>
        )}
        {paths.some((path) => path.segments?.some((segment) => segment.status !== 'safe')) && (
          <>
            <div className="overlay-item clearance-violation">未满足净空</div>
            <div className="overlay-item clearance-critical">满足净空 · 余量 &lt; 5m</div>
          </>
        )}
      </div>
    </div>
  )
}
