// import { useMemo, useState } from 'react'
// import { AuthModal } from './components/AuthModal'
// import { Header } from './components/Header'
// import { MapView } from './components/MapView'
// import { ControlPanel } from './components/ControlPanel'
// import { PathDetailCard } from './components/PathDetailCard'
// import { usePathPlanner } from './hooks/usePathPlanner'
// import { useWeather } from './hooks/useWeather'
// import type { LngLat } from './types'
// import './index.css'

// export default function App() {
//   const [showAuthModal, setShowAuthModal] = useState(false)
//   const planner = usePathPlanner()
//   const weatherLocation = useMemo<LngLat>(
//     () => [
//       (planner.start[0] + planner.end[0]) / 2,
//       (planner.start[1] + planner.end[1]) / 2,
//     ],
//     [planner.start, planner.end],
//   )
//   const weather = useWeather(weatherLocation)

//   return (
//     <div className="app">
//       <Header onLoginClick={() => setShowAuthModal(true)} />
//       <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
//       <div className="app-body">
//         <aside className="sidebar">
//           <ControlPanel
//             pickMode={planner.pickMode}
//             start={planner.start}
//             end={planner.end}
//             isPlanning={planner.isPlanning}
//             isLocating={planner.isLocating}
//             hasPaths={planner.paths.length > 0}
//             error={planner.error}
//             weather={weather.displayWeather}
//             weatherLoading={weather.isLoading}
//             onPickStart={() => planner.setPickMode('start')}
//             onPickEnd={() => planner.setPickMode('end')}
//             onPlan={planner.planPaths}
//             onClear={planner.clearAll}
//             onResetDemo={planner.resetDemo}
//             onLocateMe={planner.locateMe}
//           />
//           <div className="path-cards">
//             {planner.paths.map((path) => (
//               <PathDetailCard key={path.id} path={path} />
//             ))}
//           </div>
//         </aside>
//         <main className="map-area">
//           <MapView
//             start={planner.start}
//             end={planner.end}
//             pickMode={planner.pickMode}
//             paths={planner.paths}
//             buildings={planner.buildings}
//             weather={weather.displayWeather}
//             weatherLoading={weather.isLoading}
//             weatherError={weather.error}
//             showWeatherLayer={weather.showLayer}
//             previewCondition={weather.previewCondition}
//             onPreviewWeatherChange={weather.setPreviewCondition}
//             onToggleWeatherLayer={() => weather.setShowLayer((v) => !v)}
//             onRefreshWeather={weather.refresh}
//             onMapClick={planner.handleMapClick}
//           />
//         </main>
//       </div>
//     </div>
//   )
// }

import{BrowserRouter, Routes, Route, Navigate} from 'react-router-dom'
// import HomePage from './pages/HomePage'
// import AboutPage from './pages/AboutPage'
import PlannerPage from './pages/PlannerPage'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* <Route element={<AppLayout />}> */}
           {/* <Route path="/" element={<HomePage />} /> */}
           <Route path="planner" element={<PlannerPage />} />
           {/* <Route path="about" element={<AboutPage />} /> */}
          <Route path="*" element={<Navigate to="/" replace />} />
        {/* </Route> */}
      </Routes>

    </BrowserRouter>
  )
}