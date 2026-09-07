import type { WeatherData } from '../api/weather'
import {
  WEATHER_PREVIEW_OPTIONS,
  type WeatherCondition,
} from '../utils/weatherCodes'

interface WeatherBadgeProps {
  weather: WeatherData | null
  isLoading: boolean
  error: string | null
  showLayer: boolean
  previewCondition: WeatherCondition | null
  onPreviewChange: (condition: WeatherCondition | null) => void
  onToggleLayer: () => void
  onRefresh: () => void
}

export function WeatherBadge({
  weather,
  isLoading,
  error,
  showLayer,
  previewCondition,
  onPreviewChange,
  onToggleLayer,
  onRefresh,
}: WeatherBadgeProps) {
  return (
    <div className="weather-badge">
      <div className="weather-badge-main">
        {isLoading && !weather ? (
          <span className="weather-badge-loading">Loading weather…</span>
        ) : error && !weather ? (
          <span className="weather-badge-error">{error}</span>
        ) : weather ? (
          <>
            <span className="weather-badge-icon">{weather.icon}</span>
            <div className="weather-badge-info">
              <strong>
                {weather.label}
                {previewCondition && <em className="weather-preview-tag">Preview</em>}
              </strong>
              <span>{Math.round(weather.temperature)}°C</span>
            </div>
          </>
        ) : null}
      </div>

      {weather && (
        <div className="weather-badge-details">
          <span>Humidity {weather.humidity}%</span>
          <span>Wind speed {weather.windSpeed.toFixed(1)} km/h</span>
        </div>
      )}

      <label className="weather-preview">
        <span>Effect preview</span>
        <select
          value={previewCondition ?? ''}
          onChange={(e) =>
            onPreviewChange(e.target.value ? (e.target.value as WeatherCondition) : null)
          }
        >
          <option value="">Follow live weather</option>
          {WEATHER_PREVIEW_OPTIONS.map((option) => (
            <option key={option.condition} value={option.condition}>
              {option.icon} {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="weather-badge-actions">
        <button type="button" className="weather-btn" onClick={onToggleLayer}>
          {showLayer ? 'Hide layer' : 'Show layer'}
        </button>
        <button type="button" className="weather-btn" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}
