import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <main className="page-main home-page">
      <section className="page-hero">
        <p className="page-eyebrow">Urban Low-Altitude Flight · Intelligent Path Planning</p>
        <h1>Intelligent Drone Path Planning System</h1>
        <p className="page-lead">
          Combines building avoidance, noise assessment, wind drag, and live weather to generate shortest and optimized paths with A*, supporting safe and efficient low-altitude flight decisions.
        </p>
        <div className="page-actions">
          <Link to="/planner" className="btn btn-primary">
            Start Planning
          </Link>
          <Link to="/about" className="btn btn-ghost">
            Learn More
          </Link>
          <Link to="/workflow" className="btn btn-ghost">
            Workflow Console
          </Link>
        </div>
      </section>

      <section className="page-grid">
        <article className="page-card">
          <h2>Dual Path Comparison</h2>
          <p>Generate shortest and optimized paths side by side to compare distance, noise, and wind drag at a glance.</p>
        </article>
        <article className="page-card">
          <h2>Real-Time Weather Layer</h2>
          <p>Powered by Open-Meteo live weather, with sun, rain, fog, and other effects overlaid on the map.</p>
        </article>
        <article className="page-card">
          <h2>Multi-Factor Cost Fusion</h2>
          <p>Weighs distance, building avoidance, noise, and wind drag to produce routes that better match real-world flight.</p>
        </article>
        <Link to="/workflow" className="page-card page-card-link">
          <h2>Workflow Console</h2>
          <p>Configure the flight assistant: rename nodes, turn tools on or off, and choose which branches stop or return to the orchestrator.</p>
        </Link>
      </section>
    </main>
  )
}
