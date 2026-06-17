import { createRootRoute, Outlet } from '@tanstack/react-router'
import { NavMenu } from '../components/NavMenu'

export const Route = createRootRoute({
  component: () => (
    <>
      <NavMenu />
      <main>
        <Outlet />
      </main>
    </>
  ),
})
