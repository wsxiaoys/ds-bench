import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { fetchProducts } from '../data/products'
import { ProductCard } from '../components/ProductCard'
import { CartSidebar } from '../components/CartSidebar'
import { CategoryFilter } from '../components/CategoryFilter'
import { shopRoute } from '../router'

export function ShopPage() {
  const { category } = useSearch({ from: shopRoute.id })

  const {
    data: products = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000,
  })

  const filteredProducts =
    category === 'All' ? products : products.filter((p) => p.category === category)

  return (
    <div className="app-layout">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-brand">
          <span className="header-logo">🛍️</span>
          <div>
            <h1 className="header-title">TanStack Shop</h1>
            <p className="header-sub">Powered by TanStack Query &amp; Router</p>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="main-content">
        <div className="product-section">
          {/* Category bar */}
          {!isLoading && !isError && (
            <CategoryFilter products={products} />
          )}

          {/* Product grid */}
          {isLoading && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading products…</p>
            </div>
          )}

          {isError && (
            <div className="error-state">
              <p>⚠️ Failed to load products: {(error as Error).message}</p>
            </div>
          )}

          {!isLoading && !isError && (
            <>
              <p className="product-count">
                Showing <strong>{filteredProducts.length}</strong> product
                {filteredProducts.length !== 1 ? 's' : ''}
                {category !== 'All' ? ` in "${category}"` : ''}
              </p>
              {filteredProducts.length === 0 ? (
                <div className="empty-category">
                  <p>No products found in this category.</p>
                </div>
              ) : (
                <div className="product-grid">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Cart sidebar */}
        <CartSidebar />
      </div>
    </div>
  )
}
