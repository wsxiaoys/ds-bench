import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <div>
      <h1>E-Commerce Store</h1>
      <hr />
      <Outlet />
    </div>
  ),
})
