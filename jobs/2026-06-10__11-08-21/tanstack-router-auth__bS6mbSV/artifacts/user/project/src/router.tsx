import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  Link,
  useNavigate,
  redirect,
} from '@tanstack/react-router'
import { useAuth, AuthContextType } from './auth'

interface MyRouterContext {
  auth: AuthContextType
}

// Create the Root Route
const rootRoute = createRootRouteWithContext<MyRouterContext>()({
  component: () => (
    <div>
      <Outlet />
    </div>
  ),
})

// Home Page Route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Home Page</h1>
      <Link to="/dashboard">Go to Dashboard</Link>
    </div>
  )
}

// Login Page Route
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginComponent,
})

function LoginComponent() {
  const auth = useAuth()
  const navigate = useNavigate()

  const handleLogin = () => {
    auth.login()
    navigate({ to: '/dashboard' })
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Login Page</h1>
      <button onClick={handleLogin}>Login</button>
    </div>
  )
}

// Dashboard Page Route (Protected)
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
  component: DashboardComponent,
})

function DashboardComponent() {
  const auth = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    auth.logout()
    navigate({ to: '/login' })
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Welcome to Dashboard</h1>
      <button onClick={handleLogout}>Logout</button>
    </div>
  )
}

// Route Tree
const routeTree = rootRoute.addChildren([indexRoute, loginRoute, dashboardRoute])

// Create Router
export const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
  },
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
