import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from './__root'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/',
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <div>
      <h1>TanStack Router Demo</h1>
      <p>
        Visit{' '}
        <a
          href="/search"
          style={{ color: '#0066cc', textDecoration: 'underline' }}
        >
          /search
        </a>{' '}
        to see filters synced to URL search params.
      </p>
    </div>
  )
}