import { useSearch, useNavigate } from '@tanstack/react-router'

// ── Search param schema ──────────────────────────────────────────────────────

export interface SearchParams {
  q?: string
  category?: string
  minPrice?: number
  maxPrice?: number
}

/**
 * Validates (and coerces) raw URL search params into typed values.
 * TanStack Router calls this on every navigation to/from the route.
 */
export function searchValidateSearch(raw: Record<string, unknown>): SearchParams {
  return {
    q:        typeof raw['q']        === 'string' ? raw['q']                : undefined,
    category: typeof raw['category'] === 'string' ? raw['category']         : undefined,
    minPrice: raw['minPrice'] !== undefined        ? Number(raw['minPrice']) : undefined,
    maxPrice: raw['maxPrice'] !== undefined        ? Number(raw['maxPrice']) : undefined,
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function SearchComponent() {
  const search   = useSearch({ from: '/search' })
  const navigate = useNavigate({ from: '/search' })

  /** Helper: merge one changed field into the current search params */
  function update(patch: Partial<SearchParams>) {
    navigate({
      search: (prev) => ({ ...prev, ...patch }),
      replace: true,
    })
  }

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem', fontFamily: 'sans-serif' }}>
      <h1>Search</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* ── Text query ───────────────────────────────────────────── */}
        <label style={labelStyle}>
          <span>Query</span>
          <input
            name="q"
            type="text"
            value={search.q ?? ''}
            placeholder="Search…"
            style={inputStyle}
            onChange={(e) =>
              update({ q: e.target.value || undefined })
            }
          />
        </label>

        {/* ── Category ─────────────────────────────────────────────── */}
        <label style={labelStyle}>
          <span>Category</span>
          <input
            name="category"
            type="text"
            value={search.category ?? ''}
            placeholder="e.g. electronics"
            style={inputStyle}
            onChange={(e) =>
              update({ category: e.target.value || undefined })
            }
          />
        </label>

        {/* ── Min price ────────────────────────────────────────────── */}
        <label style={labelStyle}>
          <span>Min Price</span>
          <input
            name="minPrice"
            type="number"
            value={search.minPrice ?? ''}
            placeholder="0"
            min={0}
            style={inputStyle}
            onChange={(e) =>
              update({ minPrice: e.target.value !== '' ? Number(e.target.value) : undefined })
            }
          />
        </label>

        {/* ── Max price ────────────────────────────────────────────── */}
        <label style={labelStyle}>
          <span>Max Price</span>
          <input
            name="maxPrice"
            type="number"
            value={search.maxPrice ?? ''}
            placeholder="1000"
            min={0}
            style={inputStyle}
            onChange={(e) =>
              update({ maxPrice: e.target.value !== '' ? Number(e.target.value) : undefined })
            }
          />
        </label>

      </div>

      {/* ── Live param preview ───────────────────────────────────────── */}
      <pre style={previewStyle}>
        {JSON.stringify(search, null, 2)}
      </pre>
    </div>
  )
}

// ── Minimal inline styles ────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  fontWeight: 600,
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  fontSize: '1rem',
  border: '1px solid #ccc',
  borderRadius: 4,
}

const previewStyle: React.CSSProperties = {
  marginTop: '2rem',
  padding: '1rem',
  background: '#f4f4f4',
  borderRadius: 4,
  fontSize: '0.85rem',
}
