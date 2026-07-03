import { useNavigate, useSearch } from '@tanstack/react-router'

export function SearchPage() {
  const search = useSearch({ from: '/search' }) as {
    q?: string
    category?: string
    minPrice?: number
    maxPrice?: number
  }
  const navigate = useNavigate({ from: '/search' })

  const updateSearch = (key: 'q' | 'category' | 'minPrice' | 'maxPrice', value: string) => {
    const next: Record<string, unknown> = { ...search }
    if (value === '') {
      delete next[key]
    } else if (key === 'minPrice' || key === 'maxPrice') {
      const num = Number(value)
      if (Number.isNaN(num)) {
        delete next[key]
      } else {
        next[key] = num
      }
    } else {
      next[key] = value
    }
    navigate({ search: next, replace: true })
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: 600 }}>
      <h1>Search</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label>
          Query (q):
          <br />
          <input
            type="text"
            name="q"
            value={search.q ?? ''}
            onChange={(e) => updateSearch('q', e.target.value)}
          />
        </label>
        <label>
          Category (category):
          <br />
          <input
            type="text"
            name="category"
            value={search.category ?? ''}
            onChange={(e) => updateSearch('category', e.target.value)}
          />
        </label>
        <label>
          Min Price (minPrice):
          <br />
          <input
            type="number"
            name="minPrice"
            value={search.minPrice != null ? String(search.minPrice) : ''}
            onChange={(e) => updateSearch('minPrice', e.target.value)}
          />
        </label>
        <label>
          Max Price (maxPrice):
          <br />
          <input
            type="number"
            name="maxPrice"
            value={search.maxPrice != null ? String(search.maxPrice) : ''}
            onChange={(e) => updateSearch('maxPrice', e.target.value)}
          />
        </label>
      </div>
      <pre style={{ marginTop: '2rem', padding: '1rem', background: '#f4f4f4' }}>
        {JSON.stringify(search, null, 2)}
      </pre>
    </div>
  )
}
