import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

export const Route = createRootRoute({
  component: () => (
    <>
      <div className="p-2 flex gap-2">
        <Link to="/" className="[&.active]:font-bold" activeProps={{ className: 'active' }}>
          Home
        </Link>{' '}
        <Link to="/about" className="[&.active]:font-bold" activeProps={{ className: 'active' }}>
          About
        </Link>{' '}
        <Link to="/contact" className="[&.active]:font-bold" activeProps={{ className: 'active' }}>
          Contact
        </Link>
      </div>
      <hr />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})
