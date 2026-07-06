import { useSearch, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

type SearchParams = {
  q: string
  category: string
  minPrice: number
  maxPrice: number
}

export function SearchPage() {
  const search = useSearch({ strict: false }) as SearchParams
  const navigate = useNavigate()

  const updateFilter = useCallback(
    (key: keyof SearchParams, value: string) => {
      navigate({
        to: '/search',
        search: (prev): SearchParams => {
          const next: SearchParams = {
            q: prev?.q ?? '',
            category: prev?.category ?? '',
            minPrice: prev?.minPrice ?? 0,
            maxPrice: prev?.maxPrice ?? 0,
          }
          if (key === 'minPrice' || key === 'maxPrice') {
            const parsed = Number(value)
            next[key] = isNaN(parsed) ? 0 : parsed
          } else {
            next[key] = value
          }
          return next
        },
        replace: true,
      })
    },
    [navigate],
  )

  return (
    <main>
      <h1>Search</h1>

      <div className="filter-group">
        <label htmlFor="q">Search query</label>
        <input
          name="q"
          id="q"
          type="text"
          placeholder="Search products..."
          value={search.q ?? ''}
          onChange={(e) => updateFilter('q', e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label htmlFor="category">Category</label>
        <input
          name="category"
          id="category"
          type="text"
          placeholder="e.g. electronics"
          value={search.category ?? ''}
          onChange={(e) => updateFilter('category', e.target.value)}
        />
      </div>

      <div className="price-row">
        <div className="filter-group">
          <label htmlFor="minPrice">Min Price</label>
          <input
            name="minPrice"
            id="minPrice"
            type="number"
            min={0}
            placeholder="0"
            value={search.minPrice ?? 0}
            onChange={(e) => updateFilter('minPrice', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="maxPrice">Max Price</label>
          <input
            name="maxPrice"
            id="maxPrice"
            type="number"
            min={0}
            placeholder="1000"
            value={search.maxPrice ?? 0}
            onChange={(e) => updateFilter('maxPrice', e.target.value)}
          />
        </div>
      </div>

      <div className="current-url">
        <strong>Current search params:</strong>
        <pre>{JSON.stringify(search, null, 2)}</pre>
      </div>
    </main>
  )
}