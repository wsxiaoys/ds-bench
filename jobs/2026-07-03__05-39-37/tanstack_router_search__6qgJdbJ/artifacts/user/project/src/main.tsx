import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { SearchPage } from './SearchPage'
import './index.css'

const rootRoute = createRootRoute()

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <main>
      <h1>Home</h1>
      <p>Navigate to <a href="/search">/search</a> to try the search page.</p>
    </main>
  ),
})

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: (search: Record<string, unknown>) => ({
    q: (search.q as string) ?? '',
    category: (search.category as string) ?? '',
    minPrice: Number(search.minPrice) || 0,
    maxPrice: Number(search.maxPrice) || 0,
  }),
  component: SearchPage,
})

const routeTree = rootRoute.addChildren([indexRoute, searchRoute])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)