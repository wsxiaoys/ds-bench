import { Link } from '@tanstack/react-router'

export function Navigation() {
  return (
    <nav>
      <ul>
        <li>
          <Link to="/" activeProps={{ className: 'active' }}>
            Home
          </Link>
        </li>
        <li>
          <Link to="/about" activeProps={{ className: 'active' }}>
            About
          </Link>
        </li>
        <li>
          <Link to="/contact" activeProps={{ className: 'active' }}>
            Contact
          </Link>
        </li>
      </ul>
    </nav>
  )
}
