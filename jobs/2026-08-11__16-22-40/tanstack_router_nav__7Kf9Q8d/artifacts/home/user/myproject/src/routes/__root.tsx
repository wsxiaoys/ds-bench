import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <>
      <nav className="nav-menu">
        <Link 
          to="/" 
          className="nav-link" 
          activeProps={{ className: 'active' }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>
        <Link 
          to="/about" 
          className="nav-link" 
          activeProps={{ className: 'active' }}
        >
          About
        </Link>
        <Link 
          to="/contact" 
          className="nav-link" 
          activeProps={{ className: 'active' }}
        >
          Contact
        </Link>
      </nav>
      <div className="page-content">
        <Outlet />
      </div>
    </>
  ),
})
