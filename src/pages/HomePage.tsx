import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <main className="page-main home-page">
      <section className="page-hero">
        <p className="page-eyebrow">城市低空飞行 · 智能路径规划</p>
        <h1>无人机智能路径规划系统</h1>
        <p className="page-lead">
          融合建筑避障、噪音评估、风阻系数与实时天气，基于 A* 算法生成最短路径与智能优化路径，助力安全高效的低空飞行决策。
        </p>
        <div className="page-actions">
          <Link to="/planner" className="btn btn-primary">
            开始规划
          </Link>
          <Link to="/about" className="btn btn-ghost">
            了解更多
          </Link>
        </div>
      </section>

      <section className="page-grid">
        <article className="page-card">
          <h2>双路径对比</h2>
          <p>同时生成最短路径与智能优化路径，直观对比距离、噪音与风阻等指标。</p>
        </article>
        <article className="page-card">
          <h2>实时天气图层</h2>
          <p>接入 Open-Meteo 实时天气，在地图上叠加晴、雨、雾等可视化效果。</p>
        </article>
        <article className="page-card">
          <h2>多源代价融合</h2>
          <p>综合距离、建筑避障、噪音与风阻权重，输出更贴近实际飞行的航线方案。</p>
        </article>
      </section>
    </main>
  )
}
