import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div>
      <nav>
        <ul style={{ display: 'flex', gap: '1rem', listStyle: 'none', padding: 0 }}>
          <li>
            <Link
              to="/"
              activeProps={{ className: 'active' }}
              activeOptions={{ exact: true }}
            >
              Home
            </Link>
          </li>
          <li>
            <Link
              to="/about"
              activeProps={{ className: 'active' }}
            >
              About
            </Link>
          </li>
          <li>
            <Link
              to="/contact"
              activeProps={{ className: 'active' }}
            >
              Contact
            </Link>
          </li>
        </ul>
      </nav>
      <hr />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
