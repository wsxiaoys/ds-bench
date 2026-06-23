import { createFileRoute } from '@tanstack/react-router'
import { useSearch, useNavigate } from '@tanstack/react-router'

type SearchParams = {
  q: string
  category: string
  minPrice: number
  maxPrice: number
}

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    return {
      q: typeof search.q === 'string' ? search.q : '',
      category: typeof search.category === 'string' ? search.category : '',
      minPrice: typeof search.minPrice === 'string'
        ? Number(search.minPrice)
        : typeof search.minPrice === 'number'
          ? search.minPrice
          : 0,
      maxPrice: typeof search.maxPrice === 'string'
        ? Number(search.maxPrice)
        : typeof search.maxPrice === 'number'
          ? search.maxPrice
          : 0,
    }
  },
  component: SearchPage,
})

function SearchPage() {
  const search = useSearch({ from: '/search' })
  const navigate = useNavigate({ from: '/search' })

  const updateSearch = (updates: Partial<SearchParams>) => {
    navigate({
      search: (prev: SearchParams) => ({ ...prev, ...updates }),
    })
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px' }}>
      <h1>Search</h1>
      <form
        onSubmit={(e) => e.preventDefault()}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <label>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>Query (q)</div>
          <input
            name="q"
            type="text"
            value={search.q}
            onChange={(e) => updateSearch({ q: e.target.value })}
            placeholder="Search query..."
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>Category</div>
          <input
            name="category"
            type="text"
            value={search.category}
            onChange={(e) => updateSearch({ category: e.target.value })}
            placeholder="Category..."
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>Min Price</div>
          <input
            name="minPrice"
            type="number"
            value={search.minPrice || ''}
            onChange={(e) =>
              updateSearch({ minPrice: Number(e.target.value) || 0 })
            }
            placeholder="Min price..."
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>Max Price</div>
          <input
            name="maxPrice"
            type="number"
            value={search.maxPrice || ''}
            onChange={(e) =>
              updateSearch({ maxPrice: Number(e.target.value) || 0 })
            }
            placeholder="Max price..."
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </label>
      </form>

      <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
        <h3 style={{ margin: 0 }}>Current Search Params:</h3>
        <pre style={{ margin: '8px 0 0' }}>
          {JSON.stringify(search, null, 2)}
        </pre>
      </div>
    </div>
  )
}
