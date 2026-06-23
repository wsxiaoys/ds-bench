import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const optionalNumber = z.preprocess(
  (val) => {
    if (val === undefined || val === null || val === '') return undefined
    const num = Number(val)
    if (Number.isNaN(num)) return undefined
    return num
  },
  z.number().optional(),
)

const searchSchema = z.object({
  q: z.string().default(''),
  category: z.string().default(''),
  minPrice: optionalNumber,
  maxPrice: optionalNumber,
})

export const Route = createFileRoute('/search')({
  validateSearch: searchSchema,
  component: SearchPage,
})

function SearchPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  function updateSearch(key: string, value: string) {
    navigate({
      search: (prev) => {
        const updated = { ...prev }
        if (key === 'minPrice' || key === 'maxPrice') {
          const num = value === '' ? undefined : Number(value)
          ;(updated as Record<string, string | number | undefined>)[key] =
            Number.isNaN(num as number) ? undefined : num
        } else {
          ;(updated as Record<string, string | number | undefined>)[key] = value
        }
        return updated
      },
      replace: true,
    })
  }

  return (
    <div>
      <h1>Search</h1>
      <form>
        <div>
          <label htmlFor="q">Query</label>
          <input
            name="q"
            type="text"
            value={search.q}
            onChange={(e) => updateSearch('q', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="category">Category</label>
          <input
            name="category"
            type="text"
            value={search.category}
            onChange={(e) => updateSearch('category', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="minPrice">Min Price</label>
          <input
            name="minPrice"
            type="number"
            value={search.minPrice ?? ''}
            onChange={(e) => updateSearch('minPrice', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="maxPrice">Max Price</label>
          <input
            name="maxPrice"
            type="number"
            value={search.maxPrice ?? ''}
            onChange={(e) => updateSearch('maxPrice', e.target.value)}
          />
        </div>
      </form>
    </div>
  )
}