import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

interface HeaderProps {
  onLoginClick: () => void
}

export function Header({ onLoginClick }: HeaderProps) {
  const { user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-icon">UAV</div>
        <div>
          <h1>无人机智能路径规划系统</h1>
          <p>城市低空飞行 · 多源数据融合 · A* 智能路径优化</p>
        </div>
      </div>
      <div className="header-actions">
        <div className="header-tags">
          <span>建筑避障</span>
          <span>噪音评估</span>
          <span>风阻系数</span>
          <span>双路径对比</span>
        </div>
        <div className="header-user">
          {user ? (
            <>
              <span className="header-username">{user.username}</span>
              <button
                type="button"
                className="btn btn-ghost header-logout"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? '退出中…' : '退出登录'}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-login" onClick={onLoginClick}>
              登录
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
