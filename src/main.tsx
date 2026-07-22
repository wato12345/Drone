import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { BuildingAvoidanceProvider } from './context/BuildingAvoidanceContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BuildingAvoidanceProvider>
        <App />
      </BuildingAvoidanceProvider>
    </AuthProvider>
  </StrictMode>,
)
