import { Outlet, Link } from '@tanstack/react-router'

export function RootComponent() {
  return (
    <div>
      <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
        <Link to="/search" style={{ marginRight: '1rem' }}>
          Search
        </Link>
      </nav>
      <Outlet />
    </div>
  )
}
