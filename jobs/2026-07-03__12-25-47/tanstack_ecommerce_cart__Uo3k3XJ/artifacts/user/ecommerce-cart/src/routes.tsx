import {
  createRootRoute,
  createRoute,
  Outlet,
} from '@tanstack/react-router'
import { z } from 'zod'
import App from './App'

export const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

// Cart search schema: each item is encoded as `<productId>:<quantity>`, comma separated
// Example: /?cart=1:2,3:1 means 2 of product 1 and 1 of product 3
export const cartSearchSchema = z.object({
  cart: z.string().optional().catch(undefined),
})

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: cartSearchSchema,
  component: App,
})

export const routeTree = rootRoute.addChildren([indexRoute])
