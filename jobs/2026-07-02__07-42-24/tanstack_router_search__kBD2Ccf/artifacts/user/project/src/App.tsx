import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Link,
  Outlet,
  useNavigate,
} from '@tanstack/react-router'

// 1. Define the Search Params type
type SearchParams = {
  q?: string
  category?: string
  minPrice?: number
  maxPrice?: number
}

// Helper to parse numbers safely
const parseNumber = (val: unknown): number | undefined => {
  if (typeof val === 'number') {
    return isNaN(val) ? undefined : val
  }
  if (typeof val === 'string' && val.trim() !== '') {
    const num = Number(val)
    return isNaN(num) ? undefined : num
  }
  return undefined
}

// 2. Create the Root Route
const rootRoute = createRootRoute({
  component: () => (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <header style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
        <nav style={{ display: 'flex', gap: '15px', fontSize: '18px' }}>
          <Link 
            to="/" 
            activeProps={{ style: { fontWeight: 'bold', color: 'blue' } }}
            activeOptions={{ exact: true }}
          >
            Home
          </Link>
          <Link 
            to="/search" 
            activeProps={{ style: { fontWeight: 'bold', color: 'blue' } }}
          >
            Search
          </Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  ),
})

// 3. Create the Index Route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <div>
      <h1>Welcome to the TanStack Router Search Demo</h1>
      <p>Go to the <Link to="/search">Search Page</Link> to try out the search filters synced with the URL.</p>
    </div>
  ),
})

// 4. Create the Search Route and its component
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    return {
      q: typeof search.q === 'string' ? search.q : undefined,
      category: typeof search.category === 'string' ? search.category : undefined,
      minPrice: parseNumber(search.minPrice),
      maxPrice: parseNumber(search.maxPrice),
    }
  },
  component: SearchComponent,
})

function SearchComponent() {
  const search = searchRoute.useSearch()
  const navigate = useNavigate({ from: '/search' })

  const updateSearch = (key: keyof SearchParams, value: string | number | undefined) => {
    navigate({
      search: (prev) => {
        const next = { ...prev, [key]: value }
        // Clean up undefined or empty values to keep URL clean
        if (next[key] === undefined || next[key] === '') {
          delete next[key]
        }
        return next
      },
      replace: true, // replace history state to avoid bloating history with keystrokes
    })
  }

  return (
    <div>
      <h1>Search Page</h1>
      <p>Modify the inputs below. Notice how the URL search parameters update in real-time!</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '450px', background: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label htmlFor="q-input" style={{ fontWeight: 'bold' }}>Query (q)</label>
          <input
            id="q-input"
            type="text"
            name="q"
            value={search.q ?? ''}
            onChange={(e) => updateSearch('q', e.target.value)}
            placeholder="Search query..."
            style={{ padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label htmlFor="category-input" style={{ fontWeight: 'bold' }}>Category</label>
          <input
            id="category-input"
            type="text"
            name="category"
            value={search.category ?? ''}
            onChange={(e) => updateSearch('category', e.target.value)}
            placeholder="Category..."
            style={{ padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label htmlFor="minPrice-input" style={{ fontWeight: 'bold' }}>Min Price</label>
          <input
            id="minPrice-input"
            type="number"
            name="minPrice"
            value={search.minPrice ?? ''}
            onChange={(e) => {
              const val = e.target.value
              updateSearch('minPrice', val !== '' ? Number(val) : undefined)
            }}
            placeholder="Min price..."
            style={{ padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label htmlFor="maxPrice-input" style={{ fontWeight: 'bold' }}>Max Price</label>
          <input
            id="maxPrice-input"
            type="number"
            name="maxPrice"
            value={search.maxPrice ?? ''}
            onChange={(e) => {
              const val = e.target.value
              updateSearch('maxPrice', val !== '' ? Number(val) : undefined)
            }}
            placeholder="Max price..."
            style={{ padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
      </div>

      <div style={{ marginTop: '30px', padding: '15px', background: '#f0f4f8', borderRadius: '8px', border: '1px solid #d0e2ff' }}>
        <h3 style={{ marginTop: 0 }}>Current Parsed Search Parameters:</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              <th style={{ padding: '8px' }}>Parameter</th>
              <th style={{ padding: '8px' }}>Type</th>
              <th style={{ padding: '8px' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '8px', fontFamily: 'monospace' }}>q</td>
              <td style={{ padding: '8px' }}>{typeof search.q}</td>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>{search.q !== undefined ? `"${search.q}"` : 'undefined'}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', fontFamily: 'monospace' }}>category</td>
              <td style={{ padding: '8px' }}>{typeof search.category}</td>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>{search.category !== undefined ? `"${search.category}"` : 'undefined'}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', fontFamily: 'monospace' }}>minPrice</td>
              <td style={{ padding: '8px' }}>{typeof search.minPrice}</td>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>{search.minPrice !== undefined ? search.minPrice : 'undefined'}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', fontFamily: 'monospace' }}>maxPrice</td>
              <td style={{ padding: '8px' }}>{typeof search.maxPrice}</td>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>{search.maxPrice !== undefined ? search.maxPrice : 'undefined'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// 5. Build the Route Tree
const routeTree = rootRoute.addChildren([indexRoute, searchRoute])

// 6. Create the Router
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// 7. Render the App component
export default function App() {
  return <RouterProvider router={router} />
}
