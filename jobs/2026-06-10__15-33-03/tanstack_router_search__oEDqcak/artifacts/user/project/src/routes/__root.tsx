import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div>
      <nav>
        <Link to="/search">Search</Link>
      </nav>
      <Outlet />
    </div>
  )
}