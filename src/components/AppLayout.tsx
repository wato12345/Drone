import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AuthModal } from '../components/AuthModal'
import { Header } from '../components/Header'

export function AppLayout() {
  const [showAuthModal, setShowAuthModal] = useState(false)

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
