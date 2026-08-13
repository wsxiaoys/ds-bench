import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Navigation } from '../components/Navigation'

export const Route = createRootRoute({
  component: () => (
    <div className="app-container">
      <Navigation />
      <hr />
      <main className="content">
        <Outlet />
      </main>
    </div>
  ),
})
