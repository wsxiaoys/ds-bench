import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  getAuthState,
  login as storeLogin,
  logout as storeLogout,
  subscribe as storeSubscribe,
} from './auth-store'

interface AuthContextValue {
  isAuthenticated: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    getAuthState().isAuthenticated,
  )

  useEffect(() => {
    return storeSubscribe((s) => setIsAuthenticated(s.isAuthenticated))
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        login: storeLogin,
        logout: storeLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
