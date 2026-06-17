import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div>
      <nav style={{ padding: '10px', backgroundColor: '#f0f0f0', marginBottom: '20px' }}>
        <Link to="/" style={{ marginRight: '10px' }}>Home</Link>
        <Link to="/login" style={{ marginRight: '10px' }}>Login</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>
      <Outlet />
    </div>
  )
}