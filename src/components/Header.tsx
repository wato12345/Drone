import { useState } from 'react'
import { NavLink } from 'react-router-dom'
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
        <NavLink to="/" className="header-brand-link">
          <div className="header-icon">UAV</div>
          <div>
            <h1>Intelligent Drone Path Planning System</h1>
            <p>Urban Low-Altitude Flight · Multi-Source Data Fusion · A* Path Optimization</p>
          </div>
        </NavLink>
      </div>
      <div className="header-actions">
        <nav className="header-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'header-nav-link active' : 'header-nav-link')}>
            Home
          </NavLink>
          <NavLink
            to="/planner"
            className={({ isActive }) => (isActive ? 'header-nav-link active' : 'header-nav-link')}
          >
            Planner
          </NavLink>
          <NavLink
            to="/studio"
            className={({ isActive }) => (isActive ? 'header-nav-link active' : 'header-nav-link')}
          >
            Studio
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) => (isActive ? 'header-nav-link active' : 'header-nav-link')}
          >
            About
          </NavLink>
        </nav>
        <div className="header-tags">
          <NavLink
            to="/building-avoidance"
            className={({ isActive }) =>
              isActive ? 'header-tag-link active' : 'header-tag-link'
            }
          >
            Building Avoidance
          </NavLink>
          <NavLink
            to="/flight-settings"
            className={({ isActive }) =>
              isActive ? 'header-tag-link active' : 'header-tag-link'
            }
          >
            Drone & Noise
          </NavLink>
          <span>Wind Drag</span>
          <span>Dual Path Comparison</span>
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
                {loggingOut ? 'Logging out…' : 'Log Out'}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-login" onClick={onLoginClick}>
              Log In
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
