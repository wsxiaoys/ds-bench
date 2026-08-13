import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getDb } from '../db'

const VALID_CATEGORIES = ['electronics', 'books', 'clothing', 'home', 'toys']

const qSchema = z.preprocess((val) => {
  if (typeof val === 'string') return val
  return undefined
}, z.string()).catch('')

const categoriesSchema = z.preprocess((val) => {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') return [val]
  return []
}, z.array(z.string())).transform((arr) => {
  return arr.filter(c => VALID_CATEGORIES.includes(c))
}).catch([])

const priceSchema = (defaultValue: number) => z.preprocess((val) => {
  if (typeof val === 'string') {
    const parsed = parseFloat(val)
    return isNaN(parsed) ? undefined : parsed
  }
  if (typeof val === 'number') return val
  return undefined
}, z.number().min(0)).catch(defaultValue)

const minPriceSchema = priceSchema(0)
const maxPriceSchema = priceSchema(1000000)

const inStockSchema = z.preprocess((val) => {
  if (val === 'true' || val === true) return true
  if (val === 'false' || val === false) return false
  return undefined
}, z.boolean()).catch(false)

const sortSchema = z.enum(['name_asc', 'price_asc', 'price_desc', 'rating_desc']).catch('name_asc')

const pageSchema = z.preprocess((val) => {
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10)
    return isNaN(parsed) ? undefined : parsed
  }
  if (typeof val === 'number') return val
  return undefined
}, z.number().int().min(1)).catch(1)

const productSearchSchema = z.object({
  q: qSchema,
  categories: categoriesSchema,
  minPrice: minPriceSchema,
  maxPrice: maxPriceSchema,
  inStock: inStockSchema,
  sort: sortSchema,
  page: pageSchema,
})

type ProductSearch = z.infer<typeof productSearchSchema>

const getProducts = createServerFn({ method: 'GET' })
  .validator(productSearchSchema)
  .handler(async ({ data }) => {
    const { q, categories, minPrice, maxPrice, inStock, sort, page } = data
    const db = getDb()

    // 1. Count query
    let countQueryStr = `
      SELECT COUNT(*) as total FROM products
      WHERE (name LIKE :q OR description LIKE :q)
        AND price >= :minPrice
        AND price <= :maxPrice
        AND (:inStock = 0 OR inStock = 1)
    `
    const countParams: Record<string, any> = {
      ':q': `%${q}%`,
      ':minPrice': minPrice,
      ':maxPrice': maxPrice,
      ':inStock': inStock ? 1 : 0,
    }

    if (categories.length > 0) {
      const placeholders = categories.map((_, i) => `:cat_${i}`).join(', ')
      countQueryStr += ` AND category IN (${placeholders})`
      categories.forEach((cat, i) => {
        countParams[`:cat_${i}`] = cat
      })
    }

    const totalResult = db.prepare(countQueryStr).all(countParams) as any[]
    const total = totalResult[0]?.total || 0

    // 2. Product query
    let queryStr = `
      SELECT * FROM products
      WHERE (name LIKE :q OR description LIKE :q)
        AND price >= :minPrice
        AND price <= :maxPrice
        AND (:inStock = 0 OR inStock = 1)
    `
    const params = { ...countParams }

    if (categories.length > 0) {
      const placeholders = categories.map((_, i) => `:cat_${i}`).join(', ')
      queryStr += ` AND category IN (${placeholders})`
    }

    let orderBy = 'ORDER BY name ASC'
    if (sort === 'price_asc') {
      orderBy = 'ORDER BY price ASC'
    } else if (sort === 'price_desc') {
      orderBy = 'ORDER BY price DESC'
    } else if (sort === 'rating_desc') {
      orderBy = 'ORDER BY rating DESC'
    }
    queryStr += ` ${orderBy} LIMIT 6 OFFSET :offset`
    params[':offset'] = (page - 1) * 6

    const productsResult = db.prepare(queryStr).all(params) as any[]
    const products = productsResult.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      price: p.price,
      inStock: p.inStock === 1,
      rating: p.rating,
      createdAt: p.createdAt,
    }))

    // 3. Facet counts query (EXCLUDES the categories selection!)
    const facetQueryStr = `
      SELECT category, COUNT(*) as count FROM products
      WHERE (name LIKE :q OR description LIKE :q)
        AND price >= :minPrice
        AND price <= :maxPrice
        AND (:inStock = 0 OR inStock = 1)
      GROUP BY category
    `
    const facetParams = {
      ':q': `%${q}%`,
      ':minPrice': minPrice,
      ':maxPrice': maxPrice,
      ':inStock': inStock ? 1 : 0,
    }
    const facetResults = db.prepare(facetQueryStr).all(facetParams) as any[]
    const facetCounts: Record<string, number> = {
      electronics: 0,
      books: 0,
      clothing: 0,
      home: 0,
      toys: 0,
    }
    facetResults.forEach((row) => {
      facetCounts[row.category] = row.count
    })

    return {
      products,
      total,
      facetCounts,
    }
  })

export const Route = createFileRoute('/')({
  validateSearch: productSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    return getProducts({ data: deps })
  },
  component: App,
})

function App() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { products, total, facetCounts } = Route.useLoaderData()

  // Local state for full-text search input
  const [localQ, setLocalQ] = useState(search.q)

  useEffect(() => {
    setLocalQ(search.q)
  }, [search.q])

  // Local state for price inputs to support typing before commit
  const [localMin, setLocalMin] = useState(search.minPrice.toString())
  const [localMax, setLocalMax] = useState(search.maxPrice.toString())

  useEffect(() => {
    setLocalMin(search.minPrice.toString())
  }, [search.minPrice])

  useEffect(() => {
    setLocalMax(search.maxPrice.toString())
  }, [search.maxPrice])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    navigate({
      search: (prev) => ({
        ...prev,
        q: localQ,
        page: 1,
      }),
    })
  }

  const handleToggleCategory = (slug: string) => {
    const nextCategories = search.categories.includes(slug)
      ? search.categories.filter((c) => c !== slug)
      : [...search.categories, slug]
    navigate({
      search: (prev) => ({
        ...prev,
        categories: nextCategories,
        page: 1,
      }),
    })
  }

  const handleToggleInStock = (e: React.ChangeEvent<HTMLInputElement>) => {
    navigate({
      search: (prev) => ({
        ...prev,
        inStock: e.target.checked,
        page: 1,
      }),
    })
  }

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value
    setLocalMin(valStr)
    const val = valStr === '' ? 0 : parseFloat(valStr)
    navigate({
      search: (prev) => ({
        ...prev,
        minPrice: isNaN(val) ? 0 : val,
        page: 1,
      }),
    })
  }

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value
    setLocalMax(valStr)
    const val = valStr === '' ? 1000000 : parseFloat(valStr)
    navigate({
      search: (prev) => ({
        ...prev,
        maxPrice: isNaN(val) ? 1000000 : val,
        page: 1,
      }),
    })
  }

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    navigate({
      search: (prev) => ({
        ...prev,
        sort: e.target.value as any,
        page: 1,
      }),
    })
  }

  const totalPages = Math.max(1, Math.ceil(total / 6))

  const handlePrevPage = () => {
    if (search.page > 1) {
      navigate({
        search: (prev) => ({
          ...prev,
          page: Math.max(1, prev.page - 1),
        }),
      })
    }
  }

  const handleNextPage = () => {
    if (search.page < totalPages) {
      navigate({
        search: (prev) => ({
          ...prev,
          page: Math.min(totalPages, prev.page + 1),
        }),
      })
    }
  }

  return (
    <main className="page-wrap px-4 pb-12 pt-14">
      <header className="mb-10 text-center">
        <p className="island-kicker mb-2">E-Commerce Catalog</p>
        <h1 className="display-title text-4xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-5xl">
          Faceted Product Search
        </h1>
        <p className="mt-2 text-base text-[var(--sea-ink-soft)]">
          A fully deep-linkable, typed, server-filtered catalog powered by TanStack Start
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-4">
        {/* Sidebar Filters */}
        <aside className="lg:col-span-1 space-y-6">
          <div className="demo-panel space-y-6">
            <div>
              <h2 className="demo-section-title mb-3">Search</h2>
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  data-testid="search-input"
                  value={localQ}
                  onChange={(e) => setLocalQ(e.target.value)}
                  placeholder="Query name or desc..."
                  className="demo-input pr-10"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
                >
                  🔍
                </button>
              </form>
            </div>

            <hr className="border-[var(--line)]" />

            <div>
              <h2 className="demo-section-title mb-3">Categories</h2>
              <div className="space-y-2">
                {VALID_CATEGORIES.map((cat) => {
                  const isSelected = search.categories.includes(cat)
                  return (
                    <button
                      key={cat}
                      type="button"
                      data-testid={`facet-category-${cat}`}
                      onClick={() => handleToggleCategory(cat)}
                      className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg border transition-all text-left ${
                        isSelected
                          ? 'bg-[rgba(79,184,178,0.15)] border-[var(--lagoon-deep)] text-[var(--sea-ink)] font-semibold'
                          : 'bg-transparent border-transparent text-[var(--sea-ink-soft)] hover:bg-[var(--link-bg-hover)]'
                      }`}
                    >
                      <span className="capitalize">{cat}</span>
                      <span
                        data-testid={`facet-count-${cat}`}
                        className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--sand)] text-[var(--sea-ink-soft)] border border-[var(--line)]"
                      >
                        {facetCounts[cat]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <hr className="border-[var(--line)]" />

            <div>
              <h2 className="demo-section-title mb-3">Price Range (USD)</h2>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-[var(--sea-ink-soft)] mb-1 block">Min</label>
                  <input
                    type="number"
                    data-testid="filter-min-price"
                    value={localMin}
                    onChange={handleMinPriceChange}
                    min="0"
                    placeholder="0"
                    className="demo-input text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--sea-ink-soft)] mb-1 block">Max</label>
                  <input
                    type="number"
                    data-testid="filter-max-price"
                    value={localMax}
                    onChange={handleMaxPriceChange}
                    min="0"
                    placeholder="1000000"
                    className="demo-input text-sm"
                  />
                </div>
              </div>
            </div>

            <hr className="border-[var(--line)]" />

            <div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="filter-instock"
                  checked={search.inStock}
                  onChange={handleToggleInStock}
                  className="w-4 h-4 rounded border-[var(--line)] text-[var(--lagoon-deep)] focus:ring-[var(--lagoon)]"
                />
                <span className="text-sm font-medium text-[var(--sea-ink)]">In Stock Only</span>
              </label>
            </div>
          </div>
        </aside>

        {/* Product Results */}
        <section className="lg:col-span-3 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--surface)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
            <div className="text-sm text-[var(--sea-ink-soft)]">
              Showing <span className="font-bold text-[var(--sea-ink)]">{products.length}</span> of{' '}
              <span data-testid="results-total" className="font-bold text-[var(--sea-ink)]">
                {total}
              </span>{' '}
              products
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="sort-select" className="text-sm text-[var(--sea-ink-soft)] whitespace-nowrap">
                Sort by:
              </label>
              <select
                id="sort-select"
                data-testid="sort-select"
                value={search.sort}
                onChange={handleSortChange}
                className="demo-select text-sm py-1.5 px-3 bg-white"
              >
                <option value="name_asc">Name: A to Z</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating_desc">Rating: High to Low</option>
              </select>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="demo-panel text-center py-16">
              <span className="text-4xl mb-3 block">🛍️</span>
              <h3 className="text-lg font-bold text-[var(--sea-ink)]">No products found</h3>
              <p className="text-sm text-[var(--sea-ink-soft)] mt-1">
                Try adjusting your search query or filters.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <article
                  key={product.id}
                  data-testid="product-card"
                  className="demo-card flex flex-col h-full hover:shadow-md transition-shadow"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="demo-pill capitalize">{product.category}</span>
                      {product.inStock ? (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                          In Stock
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full">
                          Out of Stock
                        </span>
                      )}
                    </div>

                    <h3 data-testid="product-name" className="text-base font-bold text-[var(--sea-ink)] line-clamp-1">
                      {product.name}
                    </h3>

                    <p className="text-xs text-[var(--sea-ink-soft)] line-clamp-2 min-h-[2rem]">
                      {product.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--line)] flex items-center justify-between">
                    <div className="text-lg font-extrabold text-[var(--sea-ink)]">
                      ${product.price.toFixed(2)}
                    </div>
                    <div className="flex items-center gap-1 text-sm font-bold text-amber-500">
                      ⭐ {product.rating.toFixed(1)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                type="button"
                data-testid="page-prev"
                onClick={handlePrevPage}
                disabled={search.page <= 1}
                className="demo-button demo-button-secondary px-4 py-2"
              >
                ← Prev
              </button>

              <div className="text-sm font-semibold text-[var(--sea-ink-soft)]">
                Page <span data-testid="page-current" className="text-[var(--sea-ink)] font-bold">{search.page}</span> of{' '}
                <span className="text-[var(--sea-ink)] font-bold">{totalPages}</span>
              </div>

              <button
                type="button"
                data-testid="page-next"
                onClick={handleNextPage}
                disabled={search.page >= totalPages}
                className="demo-button demo-button-secondary px-4 py-2"
              >
                Next →
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
