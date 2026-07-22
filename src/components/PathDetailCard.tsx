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
          <dt>飞行距离</dt>
          <dd>{metrics.distanceKm} km</dd>
        </div>
        <div>
          <dt>预估飞行时间</dt>
          <dd>{metrics.estimatedTimeMin} min</dd>
        </div>
        <div>
          <dt>平均飞行高度</dt>
          <dd>{metrics.avgAltitudeM} m</dd>
        </div>
        {metrics.is3D && metrics.maxAltitudeM !== undefined && (
          <div>
            <dt>最高飞行高度</dt>
            <dd>{metrics.maxAltitudeM} m</dd>
          </div>
        )}
        {metrics.is3D && metrics.totalClimbM !== undefined && (
          <div>
            <dt>累计爬升</dt>
            <dd>{metrics.totalClimbM} m</dd>
          </div>
        )}
        <div>
          <dt>噪音等级</dt>
          <dd className={`noise-${metrics.noiseLevel}`}>{metrics.noiseLevel}</dd>
        </div>
        <div>
          <dt>风阻指数</dt>
          <dd>{metrics.windResistance}</dd>
        </div>
        <div>
          <dt>建筑避障评分</dt>
          <dd>{metrics.buildingAvoidance}</dd>
        </div>
      </dl>
    </article>
  )
}
