import { Outlet, createRootRoute, Link } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <header
        style={{
          padding: '1rem',
          borderBottom: '1px solid #eee',
          marginBottom: '1rem',
        }}
      >
        <Link
          to="/"
          style={{
            marginRight: '1rem',
            color: '#0066cc',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Home
        </Link>
        <Link
          to="/search"
          style={{ color: '#0066cc', textDecoration: 'none', fontWeight: 600 }}
        >
          Search
        </Link>
      </header>
      <main style={{ padding: '0 1rem' }}>
        <Outlet />
      </main>
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}