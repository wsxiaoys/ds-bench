import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <div>
      <nav style={{ padding: '10px', borderBottom: '1px solid #ccc', display: 'flex', gap: '10px' }}>
        <Link to="/" activeProps={{ style: { fontWeight: 'bold' } }}>
          Home
        </Link>
        <Link to="/users/$userId" params={{ userId: '123' }} activeProps={{ style: { fontWeight: 'bold' } }}>
          User 123
        </Link>
      </nav>
      <main style={{ padding: '20px' }}>
        <Outlet />
      </main>
    </div>
  ),
})
