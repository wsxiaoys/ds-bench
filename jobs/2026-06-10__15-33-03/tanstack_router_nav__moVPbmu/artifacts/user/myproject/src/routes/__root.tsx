import { Outlet, Link, createRootRoute } from '@tanstack/react-router'
import '../App.css'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div>
      <nav className="nav">
        <Link to="/" activeProps={{ className: 'active' }}>
          Home
        </Link>
        <Link to="/about" activeProps={{ className: 'active' }}>
          About
        </Link>
        <Link to="/contact" activeProps={{ className: 'active' }}>
          Contact
        </Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  )
}