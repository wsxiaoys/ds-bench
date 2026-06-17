import {
  createRouter,
  createRootRoute,
  createRoute,
  createHashHistory,
} from '@tanstack/react-router'
import { z } from 'zod'
import { RootComponent } from './components/RootComponent'
import { ShopPage } from './pages/ShopPage'

// ── Cart search-param schema ──────────────────────────────────────────────────
// cart is encoded as a JSON string in the URL: ?cart=[{"id":1,"qty":2},...]
const cartItemSchema = z.object({
  id: z.number(),
  qty: z.number().int().positive(),
})

export type CartItem = z.infer<typeof cartItemSchema>

const searchSchema = z.object({
  cart: z.array(cartItemSchema).optional().default([]),
  category: z.string().optional().default('All'),
})

export type ShopSearch = z.infer<typeof searchSchema>

// ── Routes ────────────────────────────────────────────────────────────────────
const rootRoute = createRootRoute({
  component: RootComponent,
})

export const shopRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ShopPage,
  validateSearch: (raw: Record<string, unknown>): ShopSearch => {
    return searchSchema.parse(raw)
  },
})

const routeTree = rootRoute.addChildren([shopRoute])

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
