import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  CRUISE_ALTITUDE_MAX_M,
  CRUISE_ALTITUDE_MIN_M,
  DEFAULT_DRONE_MODEL_ID,
  getDroneModel,
  type DroneModel,
} from '../data/droneModels'

const STORAGE_KEY = 'flight-settings'

export interface FlightSettings {
  droneModelId: string
  cruiseAltitudeM: number
  showNoiseRange: boolean
}

interface FlightSettingsContextValue extends FlightSettings {
  droneModel: DroneModel
  noiseRangeM: number
  setDroneModelId: (id: string) => void
  setCruiseAltitudeM: (altitudeM: number) => void
  setShowNoiseRange: (show: boolean) => void
  resetSettings: () => void
}

const FlightSettingsContext = createContext<FlightSettingsContextValue | null>(null)

function clampCruiseAltitude(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(CRUISE_ALTITUDE_MAX_M, Math.max(CRUISE_ALTITUDE_MIN_M, Math.round(value)))
}

function defaultSettingsForModel(modelId: string): FlightSettings {
  const model = getDroneModel(modelId)
  return {
    droneModelId: model.id,
    cruiseAltitudeM: model.cruiseAltitudeM,
    showNoiseRange: true,
  }
}

function readStoredSettings(): FlightSettings {
  const fallback = defaultSettingsForModel(DEFAULT_DRONE_MODEL_ID)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<FlightSettings>
    const model = getDroneModel(parsed.droneModelId ?? fallback.droneModelId)
    return {
      droneModelId: model.id,
      cruiseAltitudeM: clampCruiseAltitude(
        Number(parsed.cruiseAltitudeM),
        model.cruiseAltitudeM,
      ),
      showNoiseRange: parsed.showNoiseRange !== false,
    }
  } catch {
    return fallback
  }
}

function persistSettings(settings: FlightSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function FlightSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<FlightSettings>(readStoredSettings)

  const updateSettings = useCallback((next: Partial<FlightSettings>) => {
    setSettings((current) => {
      const merged = { ...current, ...next }
      persistSettings(merged)
      return merged
    })
  }, [])

  const setDroneModelId = useCallback(
    (id: string) => {
      const model = getDroneModel(id)
      updateSettings({
        droneModelId: model.id,
        cruiseAltitudeM: model.cruiseAltitudeM,
      })
    },
    [updateSettings],
  )

  const setCruiseAltitudeM = useCallback(
    (altitudeM: number) => {
      const model = getDroneModel(settings.droneModelId)
      updateSettings({
        cruiseAltitudeM: clampCruiseAltitude(altitudeM, model.cruiseAltitudeM),
      })
    },
    [settings.droneModelId, updateSettings],
  )

  const setShowNoiseRange = useCallback(
    (showNoiseRange: boolean) => updateSettings({ showNoiseRange }),
    [updateSettings],
  )

  const resetSettings = useCallback(() => {
    const defaults = defaultSettingsForModel(DEFAULT_DRONE_MODEL_ID)
    persistSettings(defaults)
    setSettings(defaults)
  }, [])

  const droneModel = getDroneModel(settings.droneModelId)

  const value = useMemo(
    () => ({
      ...settings,
      droneModel,
      noiseRangeM: droneModel.noiseRangeM,
      setDroneModelId,
      setCruiseAltitudeM,
      setShowNoiseRange,
      resetSettings,
    }),
    [settings, droneModel, setDroneModelId, setCruiseAltitudeM, setShowNoiseRange, resetSettings],
  )

  return (
    <FlightSettingsContext.Provider value={value}>{children}</FlightSettingsContext.Provider>
  )
}

export function useFlightSettings() {
  const context = useContext(FlightSettingsContext)
  if (!context) {
    throw new Error('useFlightSettings must be used within FlightSettingsProvider')
  }
  return context
}
