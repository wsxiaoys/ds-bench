import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { AuthContextValue } from '../auth'

interface RouterContext {
  auth: AuthContextValue
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <Outlet />
    </div>
  ),
})