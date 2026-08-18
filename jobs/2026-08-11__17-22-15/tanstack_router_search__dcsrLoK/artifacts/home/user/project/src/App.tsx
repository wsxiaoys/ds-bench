import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Link,
  Outlet,
  useSearch,
  useNavigate,
} from '@tanstack/react-router'

// 1. Define Search Parameters Type
type SearchParams = {
  q?: string
  category?: string
  minPrice?: number
  maxPrice?: number
}

// 2. Define Mock Data
const MOCK_PRODUCTS = [
  { id: 1, name: 'iPhone 15 Pro', category: 'Electronics', price: 999 },
  { id: 2, name: 'MacBook Air M3', category: 'Electronics', price: 1099 },
  { id: 3, name: 'Sony WH-1000XM5', category: 'Electronics', price: 399 },
  { id: 4, name: 'Ergonomic Desk Chair', category: 'Furniture', price: 299 },
  { id: 5, name: 'Standing Desk', category: 'Furniture', price: 499 },
  { id: 6, name: 'Leather Wallet', category: 'Accessories', price: 49 },
  { id: 7, name: 'Running Shoes', category: 'Apparel', price: 120 },
  { id: 8, name: 'Winter Jacket', category: 'Apparel', price: 199 },
]

// 3. Create Root Route
const rootRoute = createRootRoute({
  component: () => (
    <div style={{ fontFamily: 'var(--sans)', padding: '20px' }}>
      <header style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '20px' }}>
        <nav style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <Link
            to="/"
            activeProps={{ style: { fontWeight: 'bold', color: 'var(--accent)' } }}
            style={{ textDecoration: 'none', color: 'var(--text)' }}
          >
            Home
          </Link>
          <Link
            to="/search"
            activeProps={{ style: { fontWeight: 'bold', color: 'var(--accent)' } }}
            style={{ textDecoration: 'none', color: 'var(--text)' }}
          >
            Search Page
          </Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  ),
})

// 4. Create Index Route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <h1>TanStack Router Search Demo</h1>
      <p style={{ fontSize: '18px', color: 'var(--text)', marginBottom: '30px' }}>
        A simple React application showcasing real-time URL search parameter synchronization using TanStack Router.
      </p>
      <Link
        to="/search"
        style={{
          display: 'inline-block',
          backgroundColor: 'var(--accent)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: 'bold',
        }}
      >
        Go to Search Page
      </Link>
    </div>
  ),
})

// 5. Create Search Route with Search Param Validation
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    return {
      q: typeof search.q === 'string' && search.q !== '' ? search.q : undefined,
      category: typeof search.category === 'string' && search.category !== '' ? search.category : undefined,
      minPrice: typeof search.minPrice === 'string' || typeof search.minPrice === 'number'
        ? (search.minPrice !== '' ? Number(search.minPrice) : undefined)
        : undefined,
      maxPrice: typeof search.maxPrice === 'string' || typeof search.maxPrice === 'number'
        ? (search.maxPrice !== '' ? Number(search.maxPrice) : undefined)
        : undefined,
    }
  },
  component: SearchComponent,
})

// 6. Search Component
function SearchComponent() {
  const search = useSearch({ from: '/search' })
  const navigate = useNavigate({ from: '/search' })

  const updateSearch = (key: keyof SearchParams, value: any) => {
    navigate({
      search: (old) => {
        const next = { ...old, [key]: value }
        // Remove empty or undefined values to keep the URL clean
        if (next[key] === undefined || next[key] === '') {
          delete next[key]
        }
        return next
      },
      replace: true,
    })
  }

  // Filter products based on URL search parameters
  const filteredProducts = MOCK_PRODUCTS.filter((product) => {
    if (search.q && !product.name.toLowerCase().includes(search.q.toLowerCase())) {
      return false
    }
    if (search.category && !product.category.toLowerCase().includes(search.category.toLowerCase())) {
      return false
    }
    if (search.minPrice !== undefined && !isNaN(search.minPrice) && product.price < search.minPrice) {
      return false
    }
    if (search.maxPrice !== undefined && !isNaN(search.maxPrice) && product.price > search.maxPrice) {
      return false
    }
    return true
  })

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Search & Filter</h2>
      
      {/* Filter Inputs Panel */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          padding: '20px',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          background: 'var(--social-bg)',
          marginBottom: '30px',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label htmlFor="q" style={{ fontWeight: 'bold', fontSize: '14px' }}>Search Query</label>
          <input
            id="q"
            name="q"
            type="text"
            placeholder="Search by name (e.g. iPhone)"
            value={search.q ?? ''}
            onChange={(e) => updateSearch('q', e.target.value)}
            style={{
              padding: '10px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              fontSize: '16px',
              background: 'var(--bg)',
              color: 'var(--text-h)',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label htmlFor="category" style={{ fontWeight: 'bold', fontSize: '14px' }}>Category</label>
          <input
            id="category"
            name="category"
            type="text"
            placeholder="Search by category (e.g. Electronics)"
            value={search.category ?? ''}
            onChange={(e) => updateSearch('category', e.target.value)}
            style={{
              padding: '10px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              fontSize: '16px',
              background: 'var(--bg)',
              color: 'var(--text-h)',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
            <label htmlFor="minPrice" style={{ fontWeight: 'bold', fontSize: '14px' }}>Min Price</label>
            <input
              id="minPrice"
              name="minPrice"
              type="number"
              placeholder="0"
              value={search.minPrice ?? ''}
              onChange={(e) => {
                const val = e.target.value
                updateSearch('minPrice', val === '' ? undefined : Number(val))
              }}
              style={{
                padding: '10px',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '16px',
                background: 'var(--bg)',
                color: 'var(--text-h)',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
            <label htmlFor="maxPrice" style={{ fontWeight: 'bold', fontSize: '14px' }}>Max Price</label>
            <input
              id="maxPrice"
              name="maxPrice"
              type="number"
              placeholder="1500"
              value={search.maxPrice ?? ''}
              onChange={(e) => {
                const val = e.target.value
                updateSearch('maxPrice', val === '' ? undefined : Number(val))
              }}
              style={{
                padding: '10px',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '16px',
                background: 'var(--bg)',
                color: 'var(--text-h)',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div style={{ textAlign: 'left' }}>
        <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '15px' }}>
          Results ({filteredProducts.length})
        </h3>
        
        {filteredProducts.length === 0 ? (
          <p style={{ color: 'var(--text)', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
            No products match your current search filters.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                style={{
                  padding: '12px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', color: 'var(--text-h)' }}>{product.name}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text)' }}>{product.category}</div>
                </div>
                <div style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '18px' }}>
                  ${product.price}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Debug/Info Section */}
      <div
        style={{
          marginTop: '40px',
          padding: '15px',
          border: '1px dashed var(--accent-border)',
          borderRadius: '6px',
          background: 'var(--accent-bg)',
          fontSize: '13px',
          textAlign: 'left',
          fontFamily: 'var(--mono)',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '5px', color: 'var(--accent)' }}>URL Parameter Sync State:</div>
        <div>q: {JSON.stringify(search.q ?? null)}</div>
        <div>category: {JSON.stringify(search.category ?? null)}</div>
        <div>minPrice: {JSON.stringify(search.minPrice ?? null)}</div>
        <div>maxPrice: {JSON.stringify(search.maxPrice ?? null)}</div>
      </div>
    </div>
  )
}

// 7. Assemble Route Tree
const routeTree = rootRoute.addChildren([indexRoute, searchRoute])

// 8. Create Router Instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

// 9. Register Router for Type Safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// 10. Root App Component
export default function App() {
  return <RouterProvider router={router} />
}
