import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchCurrentUser, loginUser, logoutUser, registerUser } from '../api/auth'
import type { AuthUser } from '../types/auth'

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  error: string | null
  loginSignal: number
  requestLogin: () => void
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, email?: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loginSignal, setLoginSignal] = useState(0)

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setError(null)
    const nextUser = await loginUser({ username, password })
    setUser(nextUser)
  }, [])

  const register = useCallback(
    async (username: string, password: string, email?: string) => {
      setError(null)
      const nextUser = await registerUser({ username, password, email })
      setUser(nextUser)
    },
    [],
  )

  const logout = useCallback(async () => {
    setError(null)
    await logoutUser()
    setUser(null)
  }, [])

  const requestLogin = useCallback(() => setLoginSignal((value) => value + 1), [])

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      error,
      loginSignal,
      requestLogin,
      login,
      register,
      logout,
      clearError,
    }),
    [user, isLoading, error, loginSignal, requestLogin, login, register, logout, clearError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
