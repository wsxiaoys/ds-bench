import { Link } from '@tanstack/react-router'
import './NavMenu.css'

export function NavMenu() {
  return (
    <nav className="nav-menu">
      <Link
        to="/"
        activeProps={{ className: 'active' }}
        activeOptions={{ exact: true }}
      >
        Home
      </Link>
      <Link
        to="/about"
        activeProps={{ className: 'active' }}
      >
        About
      </Link>
      <Link
        to="/contact"
        activeProps={{ className: 'active' }}
      >
        Contact
      </Link>
    </nav>
  )
}
