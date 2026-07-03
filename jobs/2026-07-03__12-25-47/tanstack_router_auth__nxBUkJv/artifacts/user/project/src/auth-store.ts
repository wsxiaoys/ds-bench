// Module-level auth store used by both the React context components
// and the TanStack Router `beforeLoad` route guards, so the routing
// guards always see the latest authentication state.

type AuthState = { isAuthenticated: boolean }
type Listener = (state: AuthState) => void

const state: AuthState = { isAuthenticated: false }
const listeners: Set<Listener> = new Set()

export function getAuthState(): AuthState {
  return state
}

export function login(): void {
  state.isAuthenticated = true
  listeners.forEach((l) => l(state))
}

export function logout(): void {
  state.isAuthenticated = false
  listeners.forEach((l) => l(state))
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
