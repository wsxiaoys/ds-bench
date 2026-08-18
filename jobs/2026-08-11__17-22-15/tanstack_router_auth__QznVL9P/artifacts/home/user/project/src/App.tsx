import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
  Link,
  Outlet,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { AuthProvider, useAuth } from './auth'
import type { AuthContextType } from './auth'
import './App.css'

// 1. Define the router context type
interface MyRouterContext {
  auth: AuthContextType
}

// 2. Create the root route with context
const rootRoute = createRootRouteWithContext<MyRouterContext>()({
  component: () => (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <nav style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <Link to="/" activeProps={{ style: { fontWeight: 'bold' } }} activeOptions={{ exact: true }}>
          Home
        </Link>
        <Link to="/dashboard" activeProps={{ style: { fontWeight: 'bold' } }}>
          Dashboard
        </Link>
        <Link to="/login" activeProps={{ style: { fontWeight: 'bold' } }}>
          Login
        </Link>
      </nav>
      <hr />
      <Outlet />
    </div>
  ),
})

// 3. Create the public home route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <div>
      <h1>Public Home Page</h1>
      <p>Welcome to our public homepage!</p>
      <Link to="/dashboard">Go to Dashboard</Link>
    </div>
  )
}

// 4. Create the login route
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
    <div>
      <h1>Login Page</h1>
      <button onClick={handleLogin}>Login</button>
    </div>
  )
}

// 5. Create the protected dashboard route
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
    <div>
      <h1>Welcome to Dashboard</h1>
      <button onClick={handleLogout}>Logout</button>
    </div>
  )
}

// 6. Create the route tree and router
const routeTree = rootRoute.addChildren([indexRoute, loginRoute, dashboardRoute])

const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // This will be provided by the RouterProvider context prop
  },
})

// Register the router path types for type safety
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
