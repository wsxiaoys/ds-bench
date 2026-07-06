import { Link } from '@tanstack/react-router'

export default function Navigation() {
  return (
    <nav className="nav">
      <ul className="nav-list">
        <li>
          <Link
            to="/"
            activeProps={{ className: 'active' }}
            className="nav-link"
          >
            Home
          </Link>
        </li>
        <li>
          <Link
            to="/about"
            activeProps={{ className: 'active' }}
            className="nav-link"
          >
            About
          </Link>
        </li>
        <li>
          <Link
            to="/contact"
            activeProps={{ className: 'active' }}
            className="nav-link"
          >
            Contact
          </Link>
        </li>
      </ul>
    </nav>
  )
}
