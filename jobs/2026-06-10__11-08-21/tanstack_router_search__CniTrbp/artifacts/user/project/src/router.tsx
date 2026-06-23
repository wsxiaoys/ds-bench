import React, { useState, useEffect } from 'react'
import {
  Outlet,
  RouterProvider,
  Link,
  createRootRoute,
  createRoute,
  createRouter,
  useSearch,
  useNavigate,
} from '@tanstack/react-router'
import { z } from 'zod'

// Define the search parameter validation schema using Zod
const searchSchema = z.object({
  q: z.string().optional().catch(''),
  category: z.string().optional().catch(''),
  minPrice: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().optional()
  ).catch(undefined),
  maxPrice: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().optional()
  ).catch(undefined),
})

type SearchParams = z.infer<typeof searchSchema>

// Create Root Route
const rootRoute = createRootRoute({
  component: () => (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <nav style={{ display: 'flex', gap: '15px', marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <Link to="/" activeProps={{ style: { fontWeight: 'bold' } }}>
          Home
        </Link>
        <Link to="/search" activeProps={{ style: { fontWeight: 'bold' } }}>
          Search
        </Link>
      </nav>
      <Outlet />
    </div>
  ),
})

// Create Index Route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <div>
      <h2>Welcome to the TanStack Router Search App</h2>
      <p>Click on the <strong>Search</strong> link in the navigation menu to test the search page and filters.</p>
    </div>
  ),
})

// Search Component
function SearchComponent() {
  const search = useSearch({ from: '/search' })
  const navigate = useNavigate({ from: '/search' })

  // Initialize local states with validated search params
  const [q, setQ] = useState(search.q ?? '')
  const [category, setCategory] = useState(search.category ?? '')
  const [minPrice, setMinPrice] = useState(search.minPrice !== undefined ? String(search.minPrice) : '')
  const [maxPrice, setMaxPrice] = useState(search.maxPrice !== undefined ? String(search.maxPrice) : '')

  // Sync state when URL search params change externally (e.g., back navigation or initial page load)
  useEffect(() => {
    setQ(search.q ?? '')
    setCategory(search.category ?? '')
    setMinPrice(search.minPrice !== undefined ? String(search.minPrice) : '')
    setMaxPrice(search.maxPrice !== undefined ? String(search.maxPrice) : '')
  }, [search.q, search.category, search.minPrice, search.maxPrice])

  const handleQChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQ(val)
    navigate({
      search: (prev) => ({
        ...prev,
        q: val || undefined,
      }),
      replace: true,
    })
  }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setCategory(val)
    navigate({
      search: (prev) => ({
        ...prev,
        category: val || undefined,
      }),
      replace: true,
    })
  }

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setMinPrice(val)
    const num = val === '' ? undefined : Number(val)
    navigate({
      search: (prev) => ({
        ...prev,
        minPrice: num !== undefined && isNaN(num) ? undefined : num,
      }),
      replace: true,
    })
  }

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setMaxPrice(val)
    const num = val === '' ? undefined : Number(val)
    navigate({
      search: (prev) => ({
        ...prev,
        maxPrice: num !== undefined && isNaN(num) ? undefined : num,
      }),
      replace: true,
    })
  }

  return (
    <div style={{ padding: '10px 0' }}>
      <h2>Search Filters</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px' }}>
        <div>
          <label htmlFor="q" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Query (q):</label>
          <input
            id="q"
            name="q"
            type="text"
            value={q}
            onChange={handleQChange}
            placeholder="Search query..."
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label htmlFor="category" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Category:</label>
          <input
            id="category"
            name="category"
            type="text"
            value={category}
            onChange={handleCategoryChange}
            placeholder="Category..."
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label htmlFor="minPrice" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Min Price:</label>
          <input
            id="minPrice"
            name="minPrice"
            type="number"
            value={minPrice}
            onChange={handleMinPriceChange}
            placeholder="Min price..."
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label htmlFor="maxPrice" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Max Price:</label>
          <input
            id="maxPrice"
            name="maxPrice"
            type="number"
            value={maxPrice}
            onChange={handleMaxPriceChange}
            placeholder="Max price..."
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      <div style={{ marginTop: '30px', padding: '15px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
        <h3>Current Validated Search Parameters:</h3>
        <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
          <li style={{ margin: '5px 0' }}><strong>q:</strong> {search.q !== undefined ? `"${search.q}"` : 'undefined'}</li>
          <li style={{ margin: '5px 0' }}><strong>category:</strong> {search.category !== undefined ? `"${search.category}"` : 'undefined'}</li>
          <li style={{ margin: '5px 0' }}><strong>minPrice:</strong> {search.minPrice !== undefined ? search.minPrice : 'undefined'} (type: {typeof search.minPrice})</li>
          <li style={{ margin: '5px 0' }}><strong>maxPrice:</strong> {search.maxPrice !== undefined ? search.maxPrice : 'undefined'} (type: {typeof search.maxPrice})</li>
        </ul>
      </div>
    </div>
  )
}

// Create Search Route
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    return searchSchema.parse(search)
  },
  component: SearchComponent,
})

// Create Route Tree
const routeTree = rootRoute.addChildren([indexRoute, searchRoute])

// Create Router
export const router = createRouter({ routeTree })

// Register Router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function App() {
  return <RouterProvider router={router} />
}
