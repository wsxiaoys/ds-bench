import { useState, useEffect } from 'react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useSearch,
  useNavigate,
  Link,
  Outlet,
} from '@tanstack/react-router'

// 1. Create root route
const rootRoute = createRootRoute({
  component: () => (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1rem' }}>
      <nav style={{ display: 'flex', gap: '1rem', padding: '1rem', borderBottom: '1px solid #ccc', marginBottom: '1rem' }}>
        <Link to="/" activeProps={{ style: { fontWeight: 'bold' } }}>Home</Link>
        <Link to="/search" activeProps={{ style: { fontWeight: 'bold' } }}>Search</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  ),
})

// 2. Create index route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <div>
      <h1>Home Page</h1>
      <p>Welcome to the search application. Go to the <Link to="/search">Search Page</Link> to filter items.</p>
    </div>
  ),
})

type SearchParams = {
  q?: string
  category?: string
  minPrice?: number
  maxPrice?: number
}

// 3. Search Page Component
function SearchPage() {
  const search = useSearch({ from: '/search' })
  const navigate = useNavigate({ from: '/search' })

  const { q = '', category = '', minPrice, maxPrice } = search

  const [localQ, setLocalQ] = useState<string>(q)
  const [localCategory, setLocalCategory] = useState<string>(category)
  const [localMinPrice, setLocalMinPrice] = useState<string>(minPrice !== undefined ? String(minPrice) : '')
  const [localMaxPrice, setLocalMaxPrice] = useState<string>(maxPrice !== undefined ? String(maxPrice) : '')

  useEffect(() => {
    setLocalQ(q)
  }, [q])

  useEffect(() => {
    setLocalCategory(category)
  }, [category])

  useEffect(() => {
    if (minPrice !== undefined) {
      if (Number(localMinPrice) !== minPrice) {
        setLocalMinPrice(String(minPrice))
      }
    } else {
      if (localMinPrice !== '') {
        setLocalMinPrice('')
      }
    }
  }, [minPrice, localMinPrice])

  useEffect(() => {
    if (maxPrice !== undefined) {
      if (Number(localMaxPrice) !== maxPrice) {
        setLocalMaxPrice(String(maxPrice))
      }
    } else {
      if (localMaxPrice !== '') {
        setLocalMaxPrice('')
      }
    }
  }, [maxPrice, localMaxPrice])

  const handleQChange = (val: string) => {
    setLocalQ(val)
    navigate({
      search: (prev) => {
        const next = { ...prev }
        if (val) {
          next.q = val
        } else {
          delete next.q
        }
        return next
      },
      replace: true,
    })
  }

  const handleCategoryChange = (val: string) => {
    setLocalCategory(val)
    navigate({
      search: (prev) => {
        const next = { ...prev }
        if (val) {
          next.category = val
        } else {
          delete next.category
        }
        return next
      },
      replace: true,
    })
  }

  const handleMinPriceChange = (val: string) => {
    setLocalMinPrice(val)
    navigate({
      search: (prev) => {
        const next = { ...prev }
        if (val !== '') {
          const num = Number(val)
          if (!isNaN(num)) {
            next.minPrice = num
          } else {
            delete next.minPrice
          }
        } else {
          delete next.minPrice
        }
        return next
      },
      replace: true,
    })
  }

  const handleMaxPriceChange = (val: string) => {
    setLocalMaxPrice(val)
    navigate({
      search: (prev) => {
        const next = { ...prev }
        if (val !== '') {
          const num = Number(val)
          if (!isNaN(num)) {
            next.maxPrice = num
          } else {
            delete next.maxPrice
          }
        } else {
          delete next.maxPrice
        }
        return next
      },
      replace: true,
    })
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h2>Search Filters</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>Query (q):</label>
          <input
            type="text"
            name="q"
            value={localQ}
            onChange={(e) => handleQChange(e.target.value)}
            placeholder="Search..."
            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>Category:</label>
          <input
            type="text"
            name="category"
            value={localCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            placeholder="Category..."
            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>Min Price:</label>
            <input
              type="number"
              name="minPrice"
              value={localMinPrice}
              onChange={(e) => handleMinPriceChange(e.target.value)}
              placeholder="0"
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>Max Price:</label>
            <input
              type="number"
              name="maxPrice"
              value={localMaxPrice}
              onChange={(e) => handleMaxPriceChange(e.target.value)}
              placeholder="1000"
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f9f9f9', borderRadius: '4px', border: '1px solid #eee' }}>
        <h3>Active Filters:</h3>
        <ul>
          <li><strong>Query:</strong> {q || 'None'}</li>
          <li><strong>Category:</strong> {category || 'None'}</li>
          <li><strong>Min Price:</strong> {minPrice !== undefined ? minPrice : 'None'}</li>
          <li><strong>Max Price:</strong> {maxPrice !== undefined ? maxPrice : 'None'}</li>
        </ul>
      </div>
    </div>
  )
}

// 4. Create search route
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    return {
      q: typeof search.q === 'string' ? search.q : undefined,
      category: typeof search.category === 'string' ? search.category : undefined,
      minPrice: search.minPrice !== undefined && search.minPrice !== '' ? Number(search.minPrice) : undefined,
      maxPrice: search.maxPrice !== undefined && search.maxPrice !== '' ? Number(search.maxPrice) : undefined,
    }
  },
  component: SearchPage,
})

// 5. Create route tree
const routeTree = rootRoute.addChildren([indexRoute, searchRoute])

// 6. Create router
const router = createRouter({ routeTree })

// 7. Register router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  return <RouterProvider router={router} />
}
