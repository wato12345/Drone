import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AuthModal } from '../components/AuthModal'
import { Header } from '../components/Header'
import { LegacyUserAdModal } from '../components/LegacyUserAdModal'
import { useAuth } from '../context/AuthContext'
import { isLegacyUser } from '../utils/userPromo'

export function AppLayout() {
  const { user, isLoading } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showAdModal, setShowAdModal] = useState(false)

  useEffect(() => {
    if (isLoading) return

    if (!user || !isLegacyUser(user.createdAt)) {
      setShowAdModal(false)
      return
    }

    setShowAdModal(true)
  }, [isLoading, user?.id, user?.createdAt])

  return (
    <div className="app">
      <Header onLoginClick={() => setShowAuthModal(true)} />
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <LegacyUserAdModal open={showAdModal} onClose={() => setShowAdModal(false)} />
      <div className="app-content">
        <Outlet />
      </div>
    </div>
  )
}
