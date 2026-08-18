import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  Link,
  Outlet,
  RouterProvider,
  useNavigate,
} from '@tanstack/react-router'
import { AuthProvider, useAuth, AuthContextType } from './auth'

// Define root route context type
interface MyRouterContext {
  auth: AuthContextType
}

// Create root route
const rootRoute = createRootRouteWithContext<MyRouterContext>()({
  component: () => (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <Outlet />
    </div>
  ),
})

// Home page route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <div>
      <h1>Home Page</h1>
      <Link to="/dashboard">Go to Dashboard</Link>
    </div>
  ),
})

// Login page route
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: () => {
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

// Dashboard page route (protected)
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
  component: () => {
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

// Create route tree
const routeTree = rootRoute.addChildren([indexRoute, loginRoute, dashboardRoute])

// Create router
const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // This will be set dynamically via the Provider context prop
  },
})

// Register router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function App() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ auth }} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
