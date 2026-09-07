import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBuildingAvoidance } from '../context/BuildingAvoidanceContext'
import { LoadingDots } from './LoadingDots'
import type { WeatherData } from '../api/weather'
import type { LngLat, PickMode } from '../types'

interface ControlPanelProps {
  pickMode: PickMode
  start: LngLat
  end: LngLat
  startPlaceName: string | null
  endPlaceName: string | null
  placeNamesLoading: boolean
  isPlanning: boolean
  isLocating: boolean
  hasPaths: boolean
  buildingCount: number
  cruiseAltitudeM: number
  noiseRangeM: number
  droneModelName: string
  planWarning: string | null
  error: string | null
  weather: WeatherData | null
  weatherLoading: boolean
  onPickStart: () => void
  onPickEnd: () => void
  onPlan: () => void
  onClear: () => void
  onResetDemo: () => void
  onLocateMe: () => void
}

function formatCoord([lng, lat]: LngLat): string {
  return `${lng.toFixed(4)}, ${lat.toFixed(4)}`
}

export function ControlPanel({
  pickMode,
  start,
  end,
  startPlaceName,
  endPlaceName,
  placeNamesLoading,
  isPlanning,
  isLocating,
  hasPaths,
  buildingCount,
  cruiseAltitudeM,
  noiseRangeM,
  droneModelName,
  planWarning,
  error,
  weather,
  weatherLoading,
  onPickStart,
  onPickEnd,
  onPlan,
  onClear,
  onResetDemo,
  onLocateMe,
}: ControlPanelProps) {
  const [planAnimationKey, setPlanAnimationKey] = useState(0)
  const { enabled, clearanceM, setEnabled, setClearanceM } = useBuildingAvoidance()

  useEffect(() => {
    if (isPlanning) {
      setPlanAnimationKey((key) => key + 1)
    }
  }, [isPlanning])

  return (
    <section className="control-panel">
      <h2>Route Planning Console</h2>
      <p className="panel-desc">
        Select start and end points on the map. The system generates shortest and optimized routes using 3D A*; drag to rotate the map and view flight altitude.
      </p>

      <div className="coord-block">
        <div className="coord-row">
          <span className="dot start-dot" />
          <div>
            <strong>Start</strong>
            {placeNamesLoading && !startPlaceName ? (
              <LoadingDots label="Resolving place name" className="coord-place coord-place-loading" />
            ) : startPlaceName ? (
              <span className="coord-place" title={startPlaceName}>
                {startPlaceName}
              </span>
            ) : null}
            <span>{formatCoord(start)}</span>
          </div>
        </div>
        <div className="coord-row">
          <span className="dot end-dot" />
          <div>
            <strong>End</strong>
            {placeNamesLoading && !endPlaceName ? (
              <LoadingDots label="Resolving place name" className="coord-place coord-place-loading" />
            ) : endPlaceName ? (
              <span className="coord-place" title={endPlaceName}>
                {endPlaceName}
              </span>
            ) : null}
            <span>{formatCoord(end)}</span>
          </div>
        </div>
      </div>

      <div className="building-avoidance-inline">
        <div className="building-avoidance-inline-header">
          <div>
            <strong>Building avoidance</strong>
            <span>
              {enabled
                ? `Clearance ${clearanceM} m${hasPaths ? ` · ${buildingCount} buildings detected` : ''}`
                : 'Disabled'}
            </span>
          </div>
          <label className="toggle-switch" title={enabled ? 'Disable building avoidance' : 'Enable building avoidance'}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              aria-label="Enable building avoidance"
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className={`building-avoidance-inline-field${enabled ? '' : ' is-disabled'}`}>
          <div className="building-avoidance-inline-label">
            <label htmlFor="sidebar-clearance-input">Minimum clearance</label>
            <div className="building-avoidance-input-row">
              <input
                id="sidebar-clearance-input"
                type="number"
                min={5}
                max={100}
                step={1}
                value={clearanceM}
                disabled={!enabled}
                onChange={(event) => setClearanceM(Number(event.target.value))}
              />
              <span className="building-avoidance-unit">m</span>
            </div>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={clearanceM}
            disabled={!enabled}
            onChange={(event) => setClearanceM(Number(event.target.value))}
            className="building-avoidance-range"
            aria-label="Minimum clearance distance (meters)"
          />
        </div>
      </div>

      <Link to="/flight-settings" className="building-avoidance-link">
        <div>
          <strong>Drone & cruise</strong>
          <span>
            {droneModelName} · Cruise {cruiseAltitudeM} m · Noise {noiseRangeM} m
          </span>
        </div>
        <span className="building-avoidance-link-arrow">›</span>
      </Link>

      <button
        type="button"
        className="btn btn-locate"
        onClick={onLocateMe}
        disabled={isLocating}
      >
        {isLocating ? 'Locating…' : 'Locate me'}
      </button>

      <div className="button-group">
        <button
          type="button"
          className={pickMode === 'start' ? 'btn active' : 'btn'}
          onClick={onPickStart}
        >
          {pickMode === 'start' ? 'Click map to set start…' : 'Set start'}
        </button>
        <button
          type="button"
          className={pickMode === 'end' ? 'btn active' : 'btn'}
          onClick={onPickEnd}
        >
          {pickMode === 'end' ? 'Click map to set end…' : 'Set end'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClear} disabled={!hasPaths}>
          Clear paths
        </button>
        <button type="button" className="btn btn-ghost" onClick={onResetDemo}>
          Reset demo
        </button>
      </div>

      <button
        type="button"
        className={`btn btn-primary btn-plan${isPlanning ? ' planning' : ''}`}
        onClick={onPlan}
        disabled={isPlanning}
        aria-busy={isPlanning}
      >
        <span className="btn-plan-label">{isPlanning ? 'Planning…' : 'Start path planning'}</span>
        <span className="btn-plan-runway" aria-hidden={!isPlanning}>
          <span className="btn-plan-track-line" />
          <span className="btn-plan-fill" />
          <span key={planAnimationKey} className="btn-plan-drone">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="3.5" fill="currentColor" />
              <circle cx="8" cy="8" r="2.5" fill="currentColor" opacity="0.85" />
              <circle cx="24" cy="8" r="2.5" fill="currentColor" opacity="0.85" />
              <circle cx="8" cy="24" r="2.5" fill="currentColor" opacity="0.85" />
              <circle cx="24" cy="24" r="2.5" fill="currentColor" opacity="0.85" />
              <path
                d="M10.5 10.5L13.5 13.5M21.5 10.5L18.5 13.5M10.5 21.5L13.5 18.5M21.5 21.5L18.5 18.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </span>
      </button>

      {error && <p className="panel-error">{error}</p>}
      {!error && planWarning && <p className="panel-warning">{planWarning}</p>}

      <div className="weather-panel">
        <h3>Live weather</h3>
        {weatherLoading && !weather ? (
          <p className="weather-panel-status">Fetching weather…</p>
        ) : weather ? (
          <div className="weather-panel-content">
            <div className="weather-panel-main">
              <span className="weather-panel-icon">{weather.icon}</span>
              <div>
                <strong>{weather.label}</strong>
                <span>{Math.round(weather.temperature)}°C</span>
              </div>
            </div>
            <div className="weather-panel-meta">
              <span>Humidity {weather.humidity}%</span>
              <span>Wind speed {weather.windSpeed.toFixed(1)} km/h</span>
              <span>{weather.isDay ? 'Day' : 'Night'}</span>
            </div>
          </div>
        ) : (
          <p className="weather-panel-status">No weather data</p>
        )}
      </div>

      <div className="legend">
        <h3>Cost function</h3>
        <code>
          Total cost = w1×distance + w2×building avoidance + w3×noise + w4×wind resistance
        </code>
      </div>
    </section>
  )
}
