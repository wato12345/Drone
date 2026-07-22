import { Link } from 'react-router-dom'
import { useBuildingAvoidance } from '../context/BuildingAvoidanceContext'

export default function BuildingAvoidancePage() {
  const { enabled, clearanceM, setEnabled, setClearanceM, resetSettings } = useBuildingAvoidance()

  return (
    <main className="page-main building-avoidance-page">
      <section className="page-hero page-hero-compact">
        <p className="page-eyebrow">Building Avoidance</p>
        <h1>建筑规避设置</h1>
        <p className="page-lead">
          路径规划时从 OpenStreetMap 拉取真实建筑轮廓，并在 A* 网格中自动绕开楼体。
          你可以设置无人机与建筑之间的最小安全净空距离。
        </p>
      </section>

      <section className="building-avoidance-content">
        <article className="page-card building-avoidance-card">
          <div className="building-avoidance-toggle-row">
            <div>
              <h2>启用建筑规避</h2>
              <p>开启后，规划路径会避开 OSM 建筑数据，并在地图上高亮相关楼体范围。</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="building-avoidance-field">
            <label htmlFor="clearance-input">
              <span>最小净空距离（米）</span>
              <small>无人机路径与建筑轮廓之间至少保持的距离，默认 15 米</small>
            </label>
            <div className="building-avoidance-input-row">
              <input
                id="clearance-input"
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
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={clearanceM}
              disabled={!enabled}
              onChange={(event) => setClearanceM(Number(event.target.value))}
              className="building-avoidance-range"
            />
          </div>

          <div className="building-avoidance-summary">
            <strong>当前配置</strong>
            <p>
              {enabled
                ? `已启用 · 距建筑至少 ${clearanceM} 米`
                : '已关闭 · 路径规划不规避建筑'}
            </p>
          </div>
        </article>

        <article className="page-card">
          <h2>工作原理</h2>
          <ul>
            <li>根据起终点范围，从 OpenStreetMap 获取真实建筑多边形</li>
            <li>将净空距离内的网格节点标记为不可通行</li>
            <li>最短路径与智能优化路径均会绕开这些区域</li>
            <li>若起终点位于禁飞区内，会提示调整选点或净空参数</li>
          </ul>
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
