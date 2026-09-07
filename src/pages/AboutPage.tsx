import { Link } from 'react-router-dom'

export default function AboutPage() {
  return (
    <main className="page-main about-page">
      <section className="page-hero page-hero-compact">
        <p className="page-eyebrow">About</p>
        <h1>About This Project</h1>
        <p className="page-lead">
          A drone path planning demo for urban low-altitude scenarios. The frontend uses React + MapLibre GL;
          the backend provides user authentication and MySQL data persistence.
        </p>
      </section>

      <section className="about-content">
        <article className="page-card">
          <h2>Core Features</h2>
          <ul>
            <li>Map point selection and GPS positioning to set start and end points</li>
            <li>A* path planning with shortest and optimized dual routes</li>
            <li>3D building extrusion avoidance visualization</li>
            <li>Real-time weather API and animated weather map layers</li>
            <li>Optional user login (bcrypt encryption + JWT sessions)</li>
          </ul>
        </article>

        <article className="page-card">
          <h2>Tech Stack</h2>
          <dl className="about-stack">
            <div>
              <dt>Frontend</dt>
              <dd>React · TypeScript · Vite · react-map-gl · react-router-dom</dd>
            </div>
            <div>
              <dt>Backend</dt>
              <dd>Express · MySQL · bcrypt · JWT</dd>
            </div>
            <div>
              <dt>Maps</dt>
              <dd>MapLibre GL · OpenFreeMap</dd>
            </div>
            <div>
              <dt>Weather</dt>
              <dd>Open-Meteo API</dd>
            </div>
          </dl>
        </article>
      </section>

      <div className="page-actions">
        <Link to="/planner" className="btn btn-primary">
          Open Planner
        </Link>
        <Link to="/" className="btn btn-ghost">
          Back to Home
        </Link>
      </div>
    </main>
  )
}
