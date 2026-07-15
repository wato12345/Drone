import type { WeatherData } from '../api/weather'
import type { LngLat, PickMode } from '../types'

interface ControlPanelProps {
  pickMode: PickMode
  start: LngLat
  end: LngLat
  isPlanning: boolean
  isLocating: boolean
  hasPaths: boolean
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
  isPlanning,
  isLocating,
  hasPaths,
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
  return (
    <section className="control-panel">
      <h2>路径规划控制台</h2>
      <p className="panel-desc">
        在地图上选择起点与终点，系统将基于 A* 算法生成最短路径与智能优化路径。
      </p>

      <div className="coord-block">
        <div className="coord-row">
          <span className="dot start-dot" />
          <div>
            <strong>起点</strong>
            <span>{formatCoord(start)}</span>
          </div>
        </div>
        <div className="coord-row">
          <span className="dot end-dot" />
          <div>
            <strong>终点</strong>
            <span>{formatCoord(end)}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-locate"
        onClick={onLocateMe}
        disabled={isLocating}
      >
        {isLocating ? '定位中…' : '定位到我'}
      </button>

      <div className="button-group">
        <button
          type="button"
          className={pickMode === 'start' ? 'btn active' : 'btn'}
          onClick={onPickStart}
        >
          {pickMode === 'start' ? '点击地图设置起点…' : '设置起点'}
        </button>
        <button
          type="button"
          className={pickMode === 'end' ? 'btn active' : 'btn'}
          onClick={onPickEnd}
        >
          {pickMode === 'end' ? '点击地图设置终点…' : '设置终点'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClear} disabled={!hasPaths}>
          清除路径
        </button>
        <button type="button" className="btn btn-ghost" onClick={onResetDemo}>
          重置示例
        </button>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        onClick={onPlan}
        disabled={isPlanning}
      >
        {isPlanning ? '规划中…' : '开始路径规划'}
      </button>

      {error && <p className="panel-error">{error}</p>}

      <div className="weather-panel">
        <h3>实时天气</h3>
        {weatherLoading && !weather ? (
          <p className="weather-panel-status">正在获取天气…</p>
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
              <span>湿度 {weather.humidity}%</span>
              <span>风速 {weather.windSpeed.toFixed(1)} km/h</span>
              <span>{weather.isDay ? '白天' : '夜间'}</span>
            </div>
          </div>
        ) : (
          <p className="weather-panel-status">暂无天气数据</p>
        )}
      </div>

      <div className="legend">
        <h3>代价函数</h3>
        <code>
          总代价 = w1×距离 + w2×建筑避障 + w3×噪音 + w4×风阻
        </code>
      </div>
    </section>
  )
}
