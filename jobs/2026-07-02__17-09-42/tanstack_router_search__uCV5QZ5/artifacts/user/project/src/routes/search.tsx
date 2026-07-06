import { createRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { Route as RootRoute } from './__root'

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
})

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/search',
  validateSearch: searchSchema,
  component: SearchComponent,
})

function SearchComponent() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const updateSearch = (patch: Partial<z.infer<typeof searchSchema>>) => {
    navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
      }),
      replace: true,
    })
  }

  const handleNumberChange = (
    field: 'minPrice' | 'maxPrice',
    raw: string,
  ) => {
    const trimmed = raw.trim()
    if (trimmed === '') {
      updateSearch({ [field]: undefined })
      return
    }
    const parsed = Number(trimmed)
    updateSearch({ [field]: Number.isFinite(parsed) ? parsed : undefined })
  }

  const handleStringChange = (field: 'q' | 'category', raw: string) => {
    updateSearch({ [field]: raw === '' ? undefined : raw })
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1>Search</h1>
      <p style={{ color: '#555' }}>
        All filters are synced to the URL search params. Edit the inputs or the
        URL below — they stay in sync.
      </p>

      <form
        onSubmit={(e) => e.preventDefault()}
        style={{ display: 'grid', gap: '0.75rem' }}
      >
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Query (q)</span>
          <input
            name="q"
            type="text"
            value={search.q ?? ''}
            onChange={(e) => handleStringChange('q', e.target.value)}
            placeholder="search term"
          />
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Category</span>
          <input
            name="category"
            type="text"
            value={search.category ?? ''}
            onChange={(e) => handleStringChange('category', e.target.value)}
            placeholder="e.g. books"
          />
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Min Price</span>
          <input
            name="minPrice"
            type="number"
            inputMode="numeric"
            value={search.minPrice ?? ''}
            onChange={(e) => handleNumberChange('minPrice', e.target.value)}
            placeholder="0"
          />
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Max Price</span>
          <input
            name="maxPrice"
            type="number"
            inputMode="numeric"
            value={search.maxPrice ?? ''}
            onChange={(e) => handleNumberChange('maxPrice', e.target.value)}
            placeholder="1000"
          />
        </label>
      </form>

      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem' }}>Current search params</h2>
        <pre
          style={{
            background: '#f5f5f5',
            padding: '0.75rem',
            borderRadius: 4,
            overflowX: 'REDACTED',
          }}
        >
          {JSON.stringify(search, null, 2)}
        </pre>
      </section>
    </div>
  )
}