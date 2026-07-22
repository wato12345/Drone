import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'building-avoidance-settings'

export interface BuildingAvoidanceSettings {
  enabled: boolean
  clearanceM: number
}

export const DEFAULT_BUILDING_AVOIDANCE: BuildingAvoidanceSettings = {
  enabled: true,
  clearanceM: 15,
}

interface BuildingAvoidanceContextValue extends BuildingAvoidanceSettings {
  setEnabled: (enabled: boolean) => void
  setClearanceM: (clearanceM: number) => void
  updateSettings: (settings: Partial<BuildingAvoidanceSettings>) => void
  resetSettings: () => void
}

const BuildingAvoidanceContext = createContext<BuildingAvoidanceContextValue | null>(null)

function readStoredSettings(): BuildingAvoidanceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_BUILDING_AVOIDANCE
    const parsed = JSON.parse(raw) as Partial<BuildingAvoidanceSettings>
    const clearanceM = Number(parsed.clearanceM)
    return {
      enabled: parsed.enabled !== false,
      clearanceM: Number.isFinite(clearanceM) ? clearanceM : DEFAULT_BUILDING_AVOIDANCE.clearanceM,
    }
  } catch {
    return DEFAULT_BUILDING_AVOIDANCE
  }
}

function persistSettings(settings: BuildingAvoidanceSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function BuildingAvoidanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BuildingAvoidanceSettings>(readStoredSettings)

  const updateSettings = useCallback((next: Partial<BuildingAvoidanceSettings>) => {
    setSettings((current) => {
      const merged = { ...current, ...next }
      persistSettings(merged)
      return merged
    })
  }, [])

  const setEnabled = useCallback(
    (enabled: boolean) => updateSettings({ enabled }),
    [updateSettings],
  )

  const setClearanceM = useCallback(
    (clearanceM: number) => {
      const clamped = Math.min(100, Math.max(5, Math.round(clearanceM) || DEFAULT_BUILDING_AVOIDANCE.clearanceM))
      updateSettings({ clearanceM: clamped })
    },
    [updateSettings],
  )

  const resetSettings = useCallback(() => {
    persistSettings(DEFAULT_BUILDING_AVOIDANCE)
    setSettings(DEFAULT_BUILDING_AVOIDANCE)
  }, [])

  const value = useMemo(
    () => ({
      ...settings,
      setEnabled,
      setClearanceM,
      updateSettings,
      resetSettings,
    }),
    [settings, setEnabled, setClearanceM, updateSettings, resetSettings],
  )

  return (
    <BuildingAvoidanceContext.Provider value={value}>{children}</BuildingAvoidanceContext.Provider>
  )
}

export function useBuildingAvoidance() {
  const context = useContext(BuildingAvoidanceContext)
  if (!context) {
    throw new Error('useBuildingAvoidance must be used within BuildingAvoidanceProvider')
  }
  return context
}
