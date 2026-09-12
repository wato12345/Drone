import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre'
import type { WeatherData } from '../api/weather'
import type { BuildingFeature, LngLat, PickMode, PlannedPath } from '../types'
import type { WeatherCondition } from '../utils/weatherCodes'
import { WeatherBadge } from './WeatherBadge'
import { WeatherOverlay } from './WeatherOverlay'
import 'maplibre-gl/dist/maplibre-gl.css'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

interface MapViewProps {
  start: LngLat
  end: LngLat
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
  const [mapReady, setMapReady] = useState(false)

  const buildingCollection = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: buildings,
    }),
    [buildings],
  )

  const pathSources = useMemo(
    () =>
      paths.map((path) => ({
        id: path.id,
        color: path.color,
        data: {
          type: 'Feature' as const,
          properties: { color: path.color },
          geometry: {
            type: 'LineString' as const,
            coordinates: path.coordinates,
          },
        },
      })),
    [paths],
  )

  const fitBounds = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map || !mapReady) return

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
  }, [start, end, paths, mapReady])

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
        onLoad={() => setMapReady(true)}
        onClick={handleClick}
        style={{ width: '100%', height: '100%' }}
        cursor={pickMode ? 'crosshair' : 'grab'}
        attributionControl={false}
      >
        <NavigationControl position="top-right" visualizePitch />

        {buildings.length > 0 && (
          <Source id="demo-buildings" type="geojson" data={buildingCollection}>
            <Layer
              id="building-fill"
              type="fill-extrusion"
              paint={{
                'fill-extrusion-color': '#64748b',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.82,
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

        <Marker longitude={start[0]} latitude={start[1]} anchor="bottom">
          <div className="marker start-marker">起</div>
        </Marker>
        <Marker longitude={end[0]} latitude={end[1]} anchor="bottom">
          <div className="marker end-marker">终</div>
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
      </div>
    </div>
  )
}
