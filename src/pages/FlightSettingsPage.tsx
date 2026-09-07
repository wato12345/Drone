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
        <h1>Drone Model & Cruise Settings</h1>
        <p className="page-lead">
          Select a drone model to load recommended cruise altitude and noise impact radius, adjust cruise altitude manually, and simulate noise range on the map.
        </p>
      </section>

      <section className="building-avoidance-content">
        <article className="page-card building-avoidance-card">
          <h2>Drone Model Library</h2>
          <p className="page-muted">Each model includes a recommended cruise altitude and ground noise footprint radius.</p>
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
                    Cruise {model.cruiseAltitudeM} m · Noise radius {model.noiseRangeM} m
                  </small>
                </button>
              )
            })}
          </div>
        </article>

        <article className="page-card building-avoidance-card">
          <div className="building-avoidance-field">
            <label htmlFor="cruise-altitude-input">
              <span>Cruise Altitude (meters)</span>
              <small>Planning targets this altitude; paths still climb over buildings per clearance rules. Range {CRUISE_ALTITUDE_MIN_M}–{CRUISE_ALTITUDE_MAX_M} m</small>
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
              <h2>Simulate Noise Range</h2>
              <p>
                Draw the impact zone around the route using the current model&apos;s noise radius ({droneModel.noiseRangeM} m).
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
            <strong>Current Settings</strong>
            <p>
              {droneModel.name} · Cruise {cruiseAltitudeM} m · Noise radius {droneModel.noiseRangeM} m
              {showNoiseRange ? ' · Noise range shown on map' : ' · Noise range hidden'}
            </p>
          </div>
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
