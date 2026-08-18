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
import { useState, useEffect } from 'react'

// Define the search params type
type SearchParams = {
  q?: string
  category?: string
  minPrice?: number
  maxPrice?: number
}

// Root Route
const rootRoute = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <nav style={{ display: 'flex', gap: '15px', marginBottom: '20px', fontSize: '18px' }}>
        <Link 
          to="/" 
          activeProps={{ style: { fontWeight: 'bold', color: 'blue' } }}
          inactiveProps={{ style: { color: '#555' } }}
        >
          Home
        </Link>
        <Link 
          to="/search" 
          activeProps={{ style: { fontWeight: 'bold', color: 'blue' } }}
          inactiveProps={{ style: { color: '#555' } }}
        >
          Search
        </Link>
      </nav>
      <hr />
      <div style={{ marginTop: '20px' }}>
        <Outlet />
      </div>
    </div>
  )
}

// Index Route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <div>
      <h2>Home Page</h2>
      <p>Welcome to the TanStack Router Search demo!</p>
      <p>
        Click on the <Link to="/search">Search</Link> link above to go to the Search Page with URL-synced filters.
      </p>
    </div>
  )
}

// Search Route
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const q = typeof search.q === 'string' ? search.q : undefined
    const category = typeof search.category === 'string' ? search.category : undefined
    
    let minPrice: number | undefined = undefined
    if (typeof search.minPrice === 'number') {
      minPrice = search.minPrice
    } else if (typeof search.minPrice === 'string' && search.minPrice !== '') {
      const parsed = Number(search.minPrice)
      if (!isNaN(parsed)) minPrice = parsed
    }
    
    let maxPrice: number | undefined = undefined
    if (typeof search.maxPrice === 'number') {
      maxPrice = search.maxPrice
    } else if (typeof search.maxPrice === 'string' && search.maxPrice !== '') {
      const parsed = Number(search.maxPrice)
      if (!isNaN(parsed)) maxPrice = parsed
    }
    
    return {
      q,
      category,
      minPrice,
      maxPrice,
    }
  },
  component: SearchComponent,
})

// Products data
const PRODUCTS = [
  { id: 1, name: 'iPhone 15', category: 'electronics', price: 999 },
  { id: 2, name: 'MacBook Pro', category: 'electronics', price: 1999 },
  { id: 3, name: 'Science Fiction Novel', category: 'books', price: 15 },
  { id: 4, name: 'Cooking Masterclass', category: 'books', price: 25 },
  { id: 5, name: 'Leather Jacket', category: 'clothing', price: 120 },
  { id: 6, name: 'Running Shoes', category: 'clothing', price: 80 },
  { id: 7, name: 'Wireless Headphones', category: 'electronics', price: 150 },
  { id: 8, name: 'JavaScript: The Good Parts', category: 'books', price: 30 },
]

function SearchComponent() {
  // Access the search params with type-safety
  const search = useSearch({ from: '/search' })
  const navigate = useNavigate({ from: '/search' })

  // Local state for each filter input
  const [q, setQ] = useState(search.q ?? '')
  const [category, setCategory] = useState(search.category ?? '')
  const [minPrice, setMinPrice] = useState(search.minPrice !== undefined ? String(search.minPrice) : '')
  const [maxPrice, setMaxPrice] = useState(search.maxPrice !== undefined ? String(search.maxPrice) : '')

  // Sync inputs with URL parameters (e.g. on initial load or back/forward navigation)
  useEffect(() => {
    setQ(search.q ?? '')
    setCategory(search.category ?? '')
    setMinPrice(search.minPrice !== undefined ? String(search.minPrice) : '')
    setMaxPrice(search.maxPrice !== undefined ? String(search.maxPrice) : '')
  }, [search.q, search.category, search.minPrice, search.maxPrice])

  // Handlers to update local state and URL search parameters
  const updateUrl = (updates: Partial<SearchParams>) => {
    navigate({
      search: (prev) => {
        const next = { ...prev, ...updates }
        // Clean up undefined / empty values to keep URL tidy
        if (next.q === '' || next.q === undefined) delete next.q
        if (next.category === '' || next.category === undefined) delete next.category
        if (next.minPrice === undefined || isNaN(next.minPrice)) delete next.minPrice
        if (next.maxPrice === undefined || isNaN(next.maxPrice)) delete next.maxPrice
        return next
      },
      replace: true, // Replace to avoid polluting history stack during typing
    })
  }

  const handleQChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQ(val)
    updateUrl({ q: val || undefined })
  }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setCategory(val)
    updateUrl({ category: val || undefined })
  }

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setMinPrice(val)
    const num = val !== '' ? Number(val) : undefined
    updateUrl({ minPrice: num })
  }

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setMaxPrice(val)
    const num = val !== '' ? Number(val) : undefined
    updateUrl({ maxPrice: num })
  }

  // Clear all filters
  const handleClear = () => {
    setQ('')
    setCategory('')
    setMinPrice('')
    setMaxPrice('')
    navigate({
      search: () => ({}),
      replace: true,
    })
  }

  // Filter products based on search parameters
  const filteredProducts = PRODUCTS.filter((product) => {
    if (search.q && !product.name.toLowerCase().includes(search.q.toLowerCase())) {
      return false
    }
    if (search.category && !product.category.toLowerCase().includes(search.category.toLowerCase())) {
      return false
    }
    if (search.minPrice !== undefined && product.price < search.minPrice) {
      return false
    }
    if (search.maxPrice !== undefined && product.price > search.maxPrice) {
      return false
    }
    return true
  })

  return (
    <div>
      <h2>Search Products</h2>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '15px', 
        backgroundColor: '#f9f9f9', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #eee'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label htmlFor="q-input" style={{ fontWeight: '600' }}>Search Query</label>
          <input
            id="q-input"
            type="text"
            name="q"
            value={q}
            onChange={handleQChange}
            placeholder="Search by name..."
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label htmlFor="category-input" style={{ fontWeight: '600' }}>Category</label>
          <input
            id="category-input"
            type="text"
            name="category"
            value={category}
            onChange={handleCategoryChange}
            placeholder="e.g. electronics, books..."
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label htmlFor="minPrice-input" style={{ fontWeight: '600' }}>Min Price</label>
          <input
            id="minPrice-input"
            type="number"
            name="minPrice"
            value={minPrice}
            onChange={handleMinPriceChange}
            placeholder="0"
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label htmlFor="maxPrice-input" style={{ fontWeight: '600' }}>Max Price</label>
          <input
            id="maxPrice-input"
            type="number"
            name="maxPrice"
            value={maxPrice}
            onChange={handleMaxPriceChange}
            placeholder="10000"
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          onClick={handleClear}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#e0e0e0', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Clear Filters
        </button>
        <div style={{ color: '#666' }}>
          Showing {filteredProducts.length} of {PRODUCTS.length} products
        </div>
      </div>

      <div>
        <h3>Results</h3>
        {filteredProducts.length === 0 ? (
          <p style={{ color: '#999', fontStyle: 'italic' }}>No products found matching the criteria.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
            {filteredProducts.map((product) => (
              <div 
                key={product.id} 
                style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '6px', 
                  padding: '15px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
              >
                <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>{product.name}</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#555' }}>
                  <span style={{ textTransform: 'capitalize', backgroundColor: '#eef2f3', padding: '2px 6px', borderRadius: '4px' }}>
                    {product.category}
                  </span>
                  <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>${product.price}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Route Tree
const routeTree = rootRoute.addChildren([indexRoute, searchRoute])

// Create router
const router = createRouter({ routeTree })

// Register router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// App Component
export default function App() {
  return <RouterProvider router={router} />
}
