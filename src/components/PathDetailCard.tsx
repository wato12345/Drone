import type { PlannedPath } from '../types'

interface PathDetailCardProps {
  path: PlannedPath
}

export function PathDetailCard({ path }: PathDetailCardProps) {
  const { metrics } = path

  return (
    <article className="path-card" style={{ borderColor: path.color }}>
      <header>
        <span className="path-dot" style={{ background: path.color }} />
        <h3>{path.label}</h3>
      </header>
      <dl>
        <div>
          <dt>Flight distance</dt>
          <dd>{metrics.distanceKm} km</dd>
        </div>
        <div>
          <dt>Estimated flight time</dt>
          <dd>{metrics.estimatedTimeMin} min</dd>
        </div>
        <div>
          <dt>Average altitude</dt>
          <dd>{metrics.avgAltitudeM} m</dd>
        </div>
        {metrics.is3D && metrics.maxAltitudeM !== undefined && (
          <div>
            <dt>Maximum altitude</dt>
            <dd>{metrics.maxAltitudeM} m</dd>
          </div>
        )}
        {metrics.is3D && metrics.totalClimbM !== undefined && (
          <div>
            <dt>Total climb</dt>
            <dd>{metrics.totalClimbM} m</dd>
          </div>
        )}
        <div>
          <dt>Noise level</dt>
          <dd className={`noise-${metrics.noiseLevel}`}>{metrics.noiseLevel}</dd>
        </div>
        <div>
          <dt>Wind resistance index</dt>
          <dd>{metrics.windResistance}</dd>
        </div>
        <div>
          <dt>Building avoidance score</dt>
          <dd>{metrics.buildingAvoidance}</dd>
        </div>
      </dl>
    </article>
  )
}
