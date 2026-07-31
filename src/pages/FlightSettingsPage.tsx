import { Link } from 'react-router-dom'
import { useFlightSettings } from '../context/FlightSettingsContext'
import { CRUISE_ALTITUDE_MAX_M, CRUISE_ALTITUDE_MIN_M, DRONE_MODELS } from '../data/droneModels'

export default function FlightSettingsPage() {
  const {
    droneModelId,
    cruiseAltitudeM,
    showNoiseRange,
    droneModel,
    setDroneModelId,
    setCruiseAltitudeM,
    setShowNoiseRange,
    resetSettings,
  } = useFlightSettings()

  return (
    <main className="page-main building-avoidance-page">
      <section className="page-hero page-hero-compact">
        <p className="page-eyebrow">Flight Profile</p>
        <h1>机型与巡航设置</h1>
        <p className="page-lead">
          选择无人机机型以加载建议巡航高度与噪音影响半径，也可手动调整巡航高度，并在地图上模拟噪音范围。
        </p>
      </section>

      <section className="building-avoidance-content">
        <article className="page-card building-avoidance-card">
          <h2>无人机机型库</h2>
          <p className="page-muted">不同机型带有推荐巡航高度与地面噪音 footprint 半径。</p>
          <div className="drone-model-grid">
            {DRONE_MODELS.map((model) => {
              const active = model.id === droneModelId
              return (
                <button
                  key={model.id}
                  type="button"
                  className={active ? 'drone-model-card active' : 'drone-model-card'}
                  onClick={() => setDroneModelId(model.id)}
                >
                  <strong>{model.name}</strong>
                  <span>{model.description}</span>
                  <small>
                    巡航 {model.cruiseAltitudeM} m · 噪音半径 {model.noiseRangeM} m
                  </small>
                </button>
              )
            })}
          </div>
        </article>

        <article className="page-card building-avoidance-card">
          <div className="building-avoidance-field">
            <label htmlFor="cruise-altitude-input">
              <span>巡航高度（米）</span>
              <small>规划时优先保持该高度，遇建筑仍会按净空抬升；范围 {CRUISE_ALTITUDE_MIN_M}–{CRUISE_ALTITUDE_MAX_M} m</small>
            </label>
            <div className="building-avoidance-input-row">
              <input
                id="cruise-altitude-input"
                type="number"
                min={CRUISE_ALTITUDE_MIN_M}
                max={CRUISE_ALTITUDE_MAX_M}
                step={1}
                value={cruiseAltitudeM}
                onChange={(event) => setCruiseAltitudeM(Number(event.target.value))}
              />
              <span className="building-avoidance-unit">m</span>
            </div>
            <input
              type="range"
              min={CRUISE_ALTITUDE_MIN_M}
              max={CRUISE_ALTITUDE_MAX_M}
              step={1}
              value={cruiseAltitudeM}
              onChange={(event) => setCruiseAltitudeM(Number(event.target.value))}
              className="building-avoidance-range"
            />
          </div>

          <div className="building-avoidance-toggle-row">
            <div>
              <h2>模拟噪音范围</h2>
              <p>
                按当前机型噪音半径（{droneModel.noiseRangeM} m）在航线周围绘制影响范围。
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={showNoiseRange}
                onChange={(event) => setShowNoiseRange(event.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="building-avoidance-summary">
            <strong>当前配置</strong>
            <p>
              {droneModel.name} · 巡航 {cruiseAltitudeM} m · 噪音半径 {droneModel.noiseRangeM} m
              {showNoiseRange ? ' · 地图已显示噪音范围' : ' · 噪音范围已隐藏'}
            </p>
          </div>
        </article>
      </section>

      <div className="page-actions">
        <Link to="/planner" className="btn btn-primary">
          返回路径规划
        </Link>
        <button type="button" className="btn btn-ghost" onClick={resetSettings}>
          恢复默认
        </button>
      </div>
    </main>
  )
}
