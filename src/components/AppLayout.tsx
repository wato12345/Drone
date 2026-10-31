import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AuthModal } from '../components/AuthModal'
import { Header } from '../components/Header'
import { useAuth } from '../context/AuthContext'

export function AppLayout() {
  const { loginSignal } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    if (loginSignal > 0) setShowAuthModal(true)
  }, [loginSignal])

  return (
    <div className="app">
      <Header onLoginClick={() => setShowAuthModal(true)} />
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <div className="app-content">
        <Outlet />
      </div>
    </div>
  )
}
