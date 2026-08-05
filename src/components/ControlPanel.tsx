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
      <h2>路径规划控制台</h2>
      <p className="panel-desc">
        在地图上选择起点与终点，系统将基于三维 A* 算法生成最短与智能优化航线；拖动地图旋转可查看飞行高度。
      </p>

      <div className="coord-block">
        <div className="coord-row">
          <span className="dot start-dot" />
          <div>
            <strong>起点</strong>
            {placeNamesLoading && !startPlaceName ? (
              <LoadingDots label="正在解析地名" className="coord-place coord-place-loading" />
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
            <strong>终点</strong>
            {placeNamesLoading && !endPlaceName ? (
              <LoadingDots label="正在解析地名" className="coord-place coord-place-loading" />
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
            <strong>建筑规避</strong>
            <span>
              {enabled
                ? `净空 ${clearanceM} m${hasPaths ? ` · 识别 ${buildingCount} 栋` : ''}`
                : '已关闭'}
            </span>
          </div>
          <label className="toggle-switch" title={enabled ? '关闭建筑规避' : '启用建筑规避'}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              aria-label="启用建筑规避"
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className={`building-avoidance-inline-field${enabled ? '' : ' is-disabled'}`}>
          <div className="building-avoidance-inline-label">
            <label htmlFor="sidebar-clearance-input">最小净空</label>
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
            aria-label="最小净空距离（米）"
          />
        </div>
      </div>

      <Link to="/flight-settings" className="building-avoidance-link">
        <div>
          <strong>机型与巡航</strong>
          <span>
            {droneModelName} · 巡航 {cruiseAltitudeM} m · 噪音 {noiseRangeM} m
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
        className={`btn btn-primary btn-plan${isPlanning ? ' planning' : ''}`}
        onClick={onPlan}
        disabled={isPlanning}
        aria-busy={isPlanning}
      >
        <span className="btn-plan-label">{isPlanning ? '规划中…' : '开始路径规划'}</span>
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
