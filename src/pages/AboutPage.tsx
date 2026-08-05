import { Link } from 'react-router-dom'

export default function AboutPage() {
  return (
    <main className="page-main about-page">
      <section className="page-hero page-hero-compact">
        <p className="page-eyebrow">About</p>
        <h1>关于本项目</h1>
        <p className="page-lead">
          本项目是一个面向城市低空场景的无人机路径规划演示系统，前端基于 React + MapLibre GL，
          后端提供用户认证与 MySQL 数据持久化。
        </p>
      </section>

      <section className="about-content">
        <article className="page-card">
          <h2>核心功能</h2>
          <ul>
            <li>地图选点与 GPS 定位，设置起点与终点</li>
            <li>A* 算法路径规划，生成最短与优化双路径</li>
            <li>3D 建筑 extrusion 避障可视化</li>
            <li>实时天气 API 与地图天气动画图层</li>
            <li>可选用户登录（bcrypt 加密 + JWT 会话）</li>
          </ul>
        </article>

        <article className="page-card">
          <h2>技术栈</h2>
          <dl className="about-stack">
            <div>
              <dt>前端</dt>
              <dd>React · TypeScript · Vite · react-map-gl · react-router-dom</dd>
            </div>
            <div>
              <dt>后端</dt>
              <dd>Express · MySQL · bcrypt · JWT</dd>
            </div>
            <div>
              <dt>地图</dt>
              <dd>MapLibre GL · OpenFreeMap</dd>
            </div>
            <div>
              <dt>天气</dt>
              <dd>Open-Meteo API</dd>
            </div>
          </dl>
        </article>
      </section>

      <div className="page-actions">
        <Link to="/planner" className="btn btn-primary">
          进入路径规划
        </Link>
        <Link to="/" className="btn btn-ghost">
          返回首页
        </Link>
      </div>
    </main>
  )
}
