import React, { createContext, useContext, useState } from 'react'
import {
  Outlet,
  RouterProvider,
  Link,
  createRouter,
  createRoute,
  createRootRouteWithContext,
  redirect,
  useRouter,
} from '@tanstack/react-router'

interface AuthContextType {
  isAuthenticated: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const login = () => setIsAuthenticated(true)
  const logout = () => setIsAuthenticated(false)

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

interface MyRouterContext {
  auth: AuthContextType
}

const rootRoute = createRootRouteWithContext<MyRouterContext>()({
  component: () => (
    <>
      <Outlet />
    </>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: function Index() {
    return (
      <div>
        <h1>Home</h1>
        <Link to="/dashboard">Go to Dashboard</Link>
      </div>
    )
  },
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: function Login() {
    const auth = useAuth()
    const router = useRouter()

    const handleLogin = () => {
      auth.login()
      router.navigate({ to: '/dashboard' })
    }

    return (
      <div>
        <h1>Login</h1>
        <button onClick={handleLogin}>Login</button>
      </div>
    )
  },
})

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
  component: function Dashboard() {
    const auth = useAuth()
    const router = useRouter()

    const handleLogout = () => {
      auth.logout()
      router.navigate({ to: '/login' })
    }

    return (
      <div>
        <h1>Welcome to Dashboard</h1>
        <button onClick={handleLogout}>Logout</button>
      </div>
    )
  },
})

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, dashboardRoute])

const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // This will be provided by the App component
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function InnerApp() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ auth }} />
}

export default function App() {
  return (
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  )
}
