import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { App } from './App'
import { parseCartParam, serializeCartParam, type CartItems } from './cart'

// ---------------------------------------------------------------------------
// Route tree
// ---------------------------------------------------------------------------
//
// We use a single index route. Its `validateSearch` is where the magic happens:
// it parses the `cart` URL search param (e.g. `?cart=2x1,5x3`) into a typed
// `CartItems` object, and the route's `search` middlewares take care of
// serializing changes back into the URL whenever we navigate.

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

type CartSearch = {
  cart: string
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: App,
  // Parse the incoming `?cart=...` search param. Anything that isn't a valid
  // cart string is normalized to an empty string, which represents an empty
  // cart. This guarantees the search state is always well-formed.
  validateSearch: (input: Record<string, unknown>): CartSearch => {
    const raw = input.cart
    return {
      cart: typeof raw === 'string' ? raw : '',
    }
  },
  // When navigating, only keep keys we recognize (just `cart`) so that stray
  // params don't accumulate, and ensure the value is always a string.
  search: {
    middlewares: [
      ({ search, next }) => {
        const normalized: CartSearch = {
          cart: typeof search.cart === 'string' ? search.cart : '',
        }
        return next(normalized)
      },
    ],
  },
  // If the user lands on a non-`/` path, send them to the index so the cart
  // search param has a home.
  beforeLoad: ({ location }) => {
    if (location.pathname !== '/') {
      throw redirect({ to: '/', search: { cart: '' } })
    }
  },
})

const routeTree = rootRoute.addChildren([indexRoute])

// ---------------------------------------------------------------------------
// Router instance
// ---------------------------------------------------------------------------

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

// ---------------------------------------------------------------------------
// Helpers for reading / writing cart state from the URL
// ---------------------------------------------------------------------------

/** Read the current cart map from the router's search state. */
export function getCartFromSearch(search: { cart: string }): CartItems {
  return parseCartParam(search.cart)
}

/**
 * Build the next search object for a given cart map, preserving any other
 * (currently none) search params. Returns a fresh object so navigation is
 * always triggered.
 */
export function searchForCart(
  current: { cart: string },
  cart: CartItems,
): CartSearch {
  return {
    ...current,
    cart: serializeCartParam(cart),
  }
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}