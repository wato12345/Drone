import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import AboutPage from './pages/AboutPage'
import BuildingAvoidancePage from './pages/BuildingAvoidancePage'
import HomePage from './pages/HomePage'
import NotFoundRedirect from './pages/NotFoundRedirect'
import PlannerPage from './pages/PlannerPage'
import './index.css'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/building-avoidance" element={<BuildingAvoidancePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
