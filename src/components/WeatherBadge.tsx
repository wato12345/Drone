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
          <span className="weather-badge-loading">加载天气…</span>
        ) : error && !weather ? (
          <span className="weather-badge-error">{error}</span>
        ) : weather ? (
          <>
            <span className="weather-badge-icon">{weather.icon}</span>
            <div className="weather-badge-info">
              <strong>
                {weather.label}
                {previewCondition && <em className="weather-preview-tag">预览</em>}
              </strong>
              <span>{Math.round(weather.temperature)}°C</span>
            </div>
          </>
        ) : null}
      </div>

      {weather && (
        <div className="weather-badge-details">
          <span>湿度 {weather.humidity}%</span>
          <span>风速 {weather.windSpeed.toFixed(1)} km/h</span>
        </div>
      )}

      <label className="weather-preview">
        <span>效果预览</span>
        <select
          value={previewCondition ?? ''}
          onChange={(e) =>
            onPreviewChange(e.target.value ? (e.target.value as WeatherCondition) : null)
          }
        >
          <option value="">跟随实时天气</option>
          {WEATHER_PREVIEW_OPTIONS.map((option) => (
            <option key={option.condition} value={option.condition}>
              {option.icon} {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="weather-badge-actions">
        <button type="button" className="weather-btn" onClick={onToggleLayer}>
          {showLayer ? '隐藏图层' : '显示图层'}
        </button>
        <button type="button" className="weather-btn" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? '刷新中…' : '刷新'}
        </button>
      </div>
    </div>
  )
}
