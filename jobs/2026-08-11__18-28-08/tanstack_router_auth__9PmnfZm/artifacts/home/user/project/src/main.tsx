import React, { createContext, useContext, useState, ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
  Link,
  redirect,
  useNavigate,
  Outlet,
} from '@tanstack/react-router'

// 1. Mock Authentication Context
export interface AuthContextType {
  isAuthenticated: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const login = () => setIsAuthenticated(true)
  const logout = () => setIsAuthenticated(false)

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// 2. Router Context definition
interface MyRouterContext {
  auth: AuthContextType
}

// 3. Root Route definition
const rootRoute = createRootRouteWithContext<MyRouterContext>()({
  component: () => (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <nav style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <Link to="/">Home</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/login">Login</Link>
      </nav>
      <hr />
      <Outlet />
    </div>
  ),
})

// 4. Index/Home Route definition
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: function HomeComponent() {
    return (
      <div>
        <h1>Home Page</h1>
        <Link to="/dashboard">Go to Dashboard</Link>
      </div>
    )
  },
})

// 5. Login Route definition
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: function LoginComponent() {
    const auth = useAuth()
    const navigate = useNavigate()

    const handleLogin = () => {
      auth.login()
      navigate({ to: '/dashboard' })
    }

    return (
      <div>
        <h1>Login Page</h1>
        <button onClick={handleLogin}>Login</button>
      </div>
    )
  },
})

// 6. Dashboard Route definition (Protected)
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
      })
    }
  },
  component: function DashboardComponent() {
    const auth = useAuth()
    const navigate = useNavigate()

    const handleLogout = () => {
      auth.logout()
      navigate({ to: '/login' })
    }

    return (
      <div>
        <h1>Welcome to Dashboard</h1>
        <button onClick={handleLogout}>Logout</button>
      </div>
    )
  },
})

// 7. Route Tree and Router instantiation
const routeTree = rootRoute.addChildren([indexRoute, loginRoute, dashboardRoute])

const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // This will be passed dynamically from RouterProvider
  },
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// 8. Main App Component
function App() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ auth }} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)
