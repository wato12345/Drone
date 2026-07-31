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
import type { BuildingFeature, LngLat, PickMode, PlannedPath } from '../types'
import type { WeatherCondition } from '../utils/weatherCodes'
import { buildFlight3dCollections, pathHas3d } from '../utils/flight3d'
import { buildNoiseRangeFeatures } from '../utils/noiseRange'
import { LoadingDots } from './LoadingDots'
import { WeatherBadge } from './WeatherBadge'
import { WeatherOverlay } from './WeatherOverlay'
import 'maplibre-gl/dist/maplibre-gl.css'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

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
  noiseRangeM?: number
  showNoiseRange?: boolean
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
  noiseRangeM = 0,
  showNoiseRange = false,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null)

  const buildingCollection = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: buildings,
    }),
    [buildings],
  )

  const flight3d = useMemo(() => buildFlight3dCollections(paths), [paths])
  const show3dFlight = pathHas3d(paths)

  const noiseRangeCollection = useMemo(() => {
    if (!showNoiseRange || noiseRangeM <= 0 || paths.length === 0) {
      return { type: 'FeatureCollection' as const, features: [] }
    }
    const features = paths.flatMap((path) =>
      buildNoiseRangeFeatures(path.coordinates, noiseRangeM, path.color, path.id),
    )
    return { type: 'FeatureCollection' as const, features }
  }, [paths, noiseRangeM, showNoiseRange])

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
      { padding: 80, duration: 900, pitch: 62, bearing: -28 },
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
          pitch: 62,
          bearing: -28,
        }}
        mapStyle={MAP_STYLE}
        onClick={handleClick}
        style={{ width: '100%', height: '100%' }}
        cursor={pickMode ? 'crosshair' : 'grab'}
        attributionControl={false}
        maxPitch={85}
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

        {noiseRangeCollection.features.length > 0 && (
          <Source id="noise-range" type="geojson" data={noiseRangeCollection}>
            <Layer
              id="noise-range-fill"
              type="fill"
              paint={{
                'fill-color': ['get', 'color'],
                'fill-opacity': 0.22,
              }}
            />
          </Source>
        )}

        {!showNoiseRange && flight3d.ground.features.length > 0 && (
          <Source id="flight-ground-tracks" type="geojson" data={flight3d.ground}>
            <Layer
              id="flight-ground-track-line"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 1.2,
                'line-opacity': 0.35,
                'line-dasharray': [1.5, 1.5],
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
            />
          </Source>
        )}

        {show3dFlight && !showNoiseRange && flight3d.walls.features.length > 0 && (
          <Source id="flight-altitude-walls" type="geojson" data={flight3d.walls}>
            <Layer
              id="flight-altitude-walls-3d"
              type="fill-extrusion"
              paint={{
                'fill-extrusion-color': ['get', 'color'],
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.12,
              }}
            />
          </Source>
        )}

        {show3dFlight && flight3d.tubes.features.length > 0 && (
          <Source id="flight-altitude-tubes" type="geojson" data={flight3d.tubes}>
            <Layer
              id="flight-altitude-tubes-3d"
              type="fill-extrusion"
              paint={{
                'fill-extrusion-color': ['get', 'color'],
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'base'],
                'fill-extrusion-opacity': 0.82,
              }}
            />
          </Source>
        )}

        {!show3dFlight && flight3d.ground.features.length > 0 && (
          <Source id="flat-flight-paths" type="geojson" data={flight3d.ground}>
            <Layer
              id="flat-flight-path-line"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 2.5,
                'line-opacity': 0.92,
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
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
        <div className="overlay-item shortest">最短路径（A*）</div>
        <div className="overlay-item optimized">智能优化路径（A*）</div>
        {show3dFlight && <div className="overlay-item flight-3d">立体航线 · 拖动旋转看高度</div>}
        {showNoiseRange && noiseRangeM > 0 && (
          <div className="overlay-item noise-range">噪音范围 · {noiseRangeM} m</div>
        )}
        {paths.some((path) => path.segments?.some((segment) => segment.status === 'violation')) && (
          <div className="overlay-item clearance-violation">未满足净空</div>
        )}
      </div>
    </div>
  )
}
