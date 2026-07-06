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
import { AuthProvider, useAuth, AuthContextType } from './auth'

// Define the router context type
interface MyRouterContext {
  auth: AuthContextType
}

// Create the root route with context
const rootRoute = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <nav style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <Link to="/">Home</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>
      <hr />
      <div style={{ marginTop: '20px' }}>
        <Outlet />
      </div>
    </div>
  )
}

// Create the index/home route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <div>
      <h1>Home Page</h1>
      <p>Welcome to the public home page.</p>
      <Link to="/dashboard">Go to Dashboard</Link>
    </div>
  )
}

// Create the login route
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
      <p>You need to log in to access the dashboard.</p>
      <button onClick={handleLogin}>Login</button>
    </div>
  )
}

// Create the dashboard route
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
      <p>This is a protected area.</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  )
}

// Build the route tree
const routeTree = rootRoute.addChildren([indexRoute, loginRoute, dashboardRoute])

// Create the router instance
const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // This will be provided by the RouterProvider context prop
  },
})

// Register the router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function InnerApp() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ auth }} />
}

export function App() {
  return (
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  )
}
