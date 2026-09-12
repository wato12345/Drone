import { useMemo } from 'react'
import { MapView } from '../components/MapView'
import { ControlPanel } from '../components/ControlPanel'
import { KimiChat } from '../components/KimiChat'
import { PathDetailCard } from '../components/PathDetailCard'
import { usePathPlanner } from '../hooks/usePathPlanner'
import { usePlaceNames } from '../hooks/usePlaceNames'
import { useWeather } from '../hooks/useWeather'
import type { LngLat } from '../types'

export default function PlannerPage() {
  const planner = usePathPlanner()
  const placeNames = usePlaceNames(planner.start, planner.end)
  const weatherLocation = useMemo<LngLat>(
    () => [
      (planner.start[0] + planner.end[0]) / 2,
      (planner.start[1] + planner.end[1]) / 2,
    ],
    [planner.start, planner.end],
  )
  const weather = useWeather(weatherLocation)

  return (
    <div className="app-body">
      <aside className="sidebar">
        <ControlPanel
          pickMode={planner.pickMode}
          start={planner.start}
          end={planner.end}
          startPlaceName={placeNames.startName}
          endPlaceName={placeNames.endName}
          placeNamesLoading={placeNames.isLoading}
          isPlanning={planner.isPlanning}
          isLocating={planner.isLocating}
          hasPaths={planner.paths.length > 0}
          buildingCount={planner.buildingCount}
          cruiseAltitudeM={planner.cruiseAltitudeM}
          noiseRangeM={planner.noiseRangeM}
          droneModelName={planner.droneModel.name}
          planWarning={planner.planWarning}
          error={planner.error}
          weather={weather.displayWeather}
          weatherLoading={weather.isLoading}
          onPickStart={() => planner.setPickMode('start')}
          onPickEnd={() => planner.setPickMode('end')}
          onPlan={planner.planPaths}
          onClear={planner.clearAll}
          onResetDemo={planner.resetDemo}
          onLocateMe={() => {
            void planner.locateMe()
          }}
        />
        <div className="path-cards">
          {planner.paths.map((path) => (
            <PathDetailCard key={path.id} path={path} />
          ))}
        </div>
      </aside>
      <main className="map-area">
        <MapView
          start={planner.start}
          end={planner.end}
          startPlaceName={placeNames.startName}
          endPlaceName={placeNames.endName}
          placeNamesLoading={placeNames.isLoading}
          pickMode={planner.pickMode}
          paths={planner.paths}
          buildings={planner.buildings}
          weather={weather.displayWeather}
          weatherLoading={weather.isLoading}
          weatherError={weather.error}
          showWeatherLayer={weather.showLayer}
          previewCondition={weather.previewCondition}
          onPreviewWeatherChange={weather.setPreviewCondition}
          onToggleWeatherLayer={() => weather.setShowLayer((v) => !v)}
          onRefreshWeather={weather.refresh}
          onMapClick={planner.handleMapClick}
          noiseRangeM={planner.noiseRangeM}
          showNoiseRange={planner.showNoiseRange}
        />
        <KimiChat location={planner.start} placeName={placeNames.startName} />
      </main>
    </div>
  )
}
