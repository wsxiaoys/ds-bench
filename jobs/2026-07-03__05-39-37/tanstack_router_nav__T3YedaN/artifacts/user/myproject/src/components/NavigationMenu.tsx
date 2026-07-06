import { Link } from '@tanstack/react-router'

/**
 * Type-safe navigation menu.
 *
 * The `to` prop on TanStack Router's `<Link>` component is strictly typed
 * against the generated route tree. Passing an unknown path (e.g. `to="/foo"`)
 * produces a compile-time error, which is what makes navigation type-safe.
 *
 * `activeProps` is applied to the rendered element only when the link matches
 * the currently active route, so we use it to add the `active` CSS class.
 */
export function NavigationMenu() {
  return (
    <nav className="navigation-menu">
      <Link
        to="/"
        activeProps={{ className: 'active' }}
        className="navigation-link"
      >
        Home
      </Link>
      <Link
        to="/about"
        activeProps={{ className: 'active' }}
        className="navigation-link"
      >
        About
      </Link>
      <Link
        to="/contact"
        activeProps={{ className: 'active' }}
        className="navigation-link"
      >
        Contact
      </Link>
    </nav>
  )
}