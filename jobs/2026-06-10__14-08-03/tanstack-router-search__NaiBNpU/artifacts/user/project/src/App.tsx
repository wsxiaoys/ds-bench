import {
  Outlet,
  RouterProvider,
  createRouter,
  createRoute,
  createRootRoute,
  useNavigate
} from '@tanstack/react-router'

const rootRoute = createRootRoute({
  component: () => (
    <div>
      <Outlet />
    </div>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <div>Home Page. Go to <a href="/search">Search</a></div>,
})

type SearchParams = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    return {
      q: search.q as string | undefined,
      category: search.category as string | undefined,
      minPrice: search.minPrice !== undefined && search.minPrice !== '' && !isNaN(Number(search.minPrice)) ? Number(search.minPrice) : undefined,
      maxPrice: search.maxPrice !== undefined && search.maxPrice !== '' && !isNaN(Number(search.maxPrice)) ? Number(search.maxPrice) : undefined,
    }
  },
  component: SearchPage,
})

function SearchPage() {
  const search = searchRoute.useSearch()
  const navigate = useNavigate({ from: searchRoute.id })

  const updateSearch = (updates: Partial<SearchParams>) => {
    navigate({
      search: (prev) => {
        const newSearch = { ...prev, ...updates }
        return newSearch
      },
      replace: true,
    })
  }

  return (
    <div>
      <h1>Search</h1>
      <div>
        <label>
          Query:
          <input
            name="q"
            value={search.q || ''}
            onChange={(e) => updateSearch({ q: e.target.value || undefined })}
          />
        </label>
      </div>
      <div>
        <label>
          Category:
          <input
            name="category"
            value={search.category || ''}
            onChange={(e) => updateSearch({ category: e.target.value || undefined })}
          />
        </label>
      </div>
      <div>
        <label>
          Min Price:
          <input
            name="minPrice"
            type="number"
            value={search.minPrice ?? ''}
            onChange={(e) => updateSearch({ minPrice: e.target.value ? Number(e.target.value) : undefined })}
          />
        </label>
      </div>
      <div>
        <label>
          Max Price:
          <input
            name="maxPrice"
            type="number"
            value={search.maxPrice ?? ''}
            onChange={(e) => updateSearch({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}
          />
        </label>
      </div>
    </div>
  )
}

const routeTree = rootRoute.addChildren([indexRoute, searchRoute])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function App() {
  return <RouterProvider router={router} />
}

export default App
