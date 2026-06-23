import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <>
      <div style={{ padding: '10px', display: 'flex', gap: '10px' }}>
        <Link to="/">Home</Link>
        <Link to="/users/$userId" params={{ userId: '123' }}>User Profile (123)</Link>
      </div>
      <hr />
      <Outlet />
    </>
  ),
})
