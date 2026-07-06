import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <>
      <nav className="nav-menu">
        <Link to="/" className="nav-link" activeProps={{ className: 'active' }}>
          Home
        </Link>
        <Link to="/about" className="nav-link" activeProps={{ className: 'active' }}>
          About
        </Link>
        <Link to="/contact" className="nav-link" activeProps={{ className: 'active' }}>
          Contact
        </Link>
      </nav>
      <main style={{ padding: '20px', flexGrow: 1 }}>
        <Outlet />
      </main>
    </>
  ),
})
