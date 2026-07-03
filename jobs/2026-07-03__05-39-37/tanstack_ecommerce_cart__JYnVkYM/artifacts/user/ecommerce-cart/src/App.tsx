import { useQuery } from '@tanstack/react-query'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { fetchProducts } from './products'
import {
  getCartFromSearch,
  searchForCart,
} from './router'
import {
  buildCartLines,
  cartTotal,
  cartCount,
  type CartItems,
} from './cart'
import { ProductCard } from './components/ProductCard'
import { CartPanel } from './components/CartPanel'

export function App() {
  const search = useSearch({ from: '/' })
  const navigate = useNavigate()

  // Fetch the product catalog with TanStack Query.
  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  // The single source of truth for the cart: the URL search params.
  const cart = getCartFromSearch(search)
  const products = productsQuery.data ?? []
  const cartLines = buildCartLines(cart, products)
  const total = cartTotal(cartLines)
  const count = cartCount(cart)

  // Update the cart map and write it back to the URL. Because the cart lives
  // entirely in the search params, this is all that's required to persist a
  // change — a refresh will restore the exact same state.
  function updateCart(next: CartItems) {
    navigate({
      to: '/',
      search: searchForCart(search, next),
      replace: false,
    })
  }

  function addToCart(productId: number) {
    const next = { ...cart, [productId]: (cart[productId] ?? 0) + 1 }
    updateCart(next)
  }

  function decrement(productId: number) {
    const next = { ...cart }
    const current = next[productId] ?? 0
    if (current <= 1) {
      delete next[productId]
    } else {
      next[productId] = current - 1
    }
    updateCart(next)
  }

  function increment(productId: number) {
    updateCart({ ...cart, [productId]: (cart[productId] ?? 0) + 1 })
  }

  function removeFromCart(productId: number) {
    const next = { ...cart }
    delete next[productId]
    updateCart(next)
  }

  function clearCart() {
    updateCart({})
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <span className="logo">🛒</span> Shoppy
        </h1>
        <div className="header-cart">
          <span className="cart-badge">{count}</span>
          <span className="cart-total">${total.toFixed(2)}</span>
        </div>
      </header>

      <main className="app-main">
        <section className="products-section">
          <div className="section-head">
            <h2>Products</h2>
            {productsQuery.isLoading && <span className="muted">Loading…</span>}
            {productsQuery.isError && (
              <span className="error">Failed to load products.</span>
            )}
          </div>

          {productsQuery.isLoading ? (
            <div className="grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="card skeleton" key={i} />
              ))}
            </div>
          ) : (
            <div className="grid">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  quantity={cart[p.id] ?? 0}
                  onAdd={() => addToCart(p.id)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="cart-section">
          <CartPanel
            lines={cartLines}
            total={total}
            count={count}
            onIncrement={increment}
            onDecrement={decrement}
            onRemove={removeFromCart}
            onClear={clearCart}
          />
        </aside>
      </main>

      <footer className="app-footer">
        <p>
          Cart state is stored entirely in the URL. Try refreshing the page —
          your cart will be restored.
        </p>
      </footer>
    </div>
  )
}