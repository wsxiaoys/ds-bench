import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <>
      <nav>
        <Link to="/" activeProps={{ className: 'active' }} activeOptions={{ exact: true }}>
          Home
        </Link>
        <Link to="/about" activeProps={{ className: 'active' }}>
          About
        </Link>
        <Link to="/contact" activeProps={{ className: 'active' }}>
          Contact
        </Link>
      </nav>
      <div className="container">
        <Outlet />
      </div>
    </>
  ),
})
