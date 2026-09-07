import { Link } from 'react-router-dom'
import { useBuildingAvoidance } from '../context/BuildingAvoidanceContext'

export default function BuildingAvoidancePage() {
  const { enabled, clearanceM, setEnabled, setClearanceM, resetSettings } = useBuildingAvoidance()

  return (
    <main className="page-main building-avoidance-page">
      <section className="page-hero page-hero-compact">
        <p className="page-eyebrow">Building Avoidance</p>
        <h1>Building Avoidance Settings</h1>
        <p className="page-lead">
          During path planning, real building footprints are fetched from OpenStreetMap and automatically avoided in the A* grid.
          You can set the minimum safe clearance between the drone and buildings.
        </p>
      </section>

      <section className="building-avoidance-content">
        <article className="page-card building-avoidance-card">
          <div className="building-avoidance-toggle-row">
            <div>
              <h2>Enable Building Avoidance</h2>
              <p>When enabled, planned routes avoid OSM building data and highlight affected building areas on the map.</p>
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
              <span>Minimum Clearance (meters)</span>
              <small>Minimum distance between the flight path and building outlines; default 15 m</small>
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
            <strong>Current Settings</strong>
            <p>
              {enabled
                ? `Enabled · At least ${clearanceM} m from buildings`
                : 'Disabled · Path planning does not avoid buildings'}
            </p>
          </div>
        </article>

        <article className="page-card">
          <h2>How It Works</h2>
          <ul>
            <li>Fetches real building polygons from OpenStreetMap based on the start/end bounding area</li>
            <li>Marks grid nodes within the clearance distance as impassable</li>
            <li>Both shortest and optimized paths route around these zones</li>
            <li>If start or end lies in a no-fly zone, prompts you to adjust points or clearance</li>
          </ul>
        </article>
      </section>

      <div className="page-actions">
        <Link to="/planner" className="btn btn-primary">
          Back to Planner
        </Link>
        <button type="button" className="btn btn-ghost" onClick={resetSettings}>
          Reset to Defaults
        </button>
      </div>
    </main>
  )
}
