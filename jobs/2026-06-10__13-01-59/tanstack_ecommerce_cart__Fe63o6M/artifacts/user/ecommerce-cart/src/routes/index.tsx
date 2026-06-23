import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { useSuspenseQuery } from '@tanstack/react-query'
import { fetchProducts } from '../lib/api'
import type { Product } from '../lib/mock-data'
import { CartDisplay } from '../components/CartDisplay'
import { ProductCard } from '../components/ProductCard'

// Cart item stored as: "id:qty,id:qty,..."
// Example: "prod-1:2,prod-3:1"
const cartSchema = z.object({
  cart: z.string().optional(),
})

export type CartSearchParams = z.infer<typeof cartSchema>

function parseCart(cartStr: string | undefined): Map<string, number> {
  const map = new Map<string, number>()
  if (!cartStr) return map
  const entries = cartStr.split(',').filter(Boolean)
  for (const entry of entries) {
    const [id, qtyStr] = entry.split(':')
    const qty = parseInt(qtyStr, 10)
    if (id && !isNaN(qty) && qty > 0) {
      map.set(id, qty)
    }
  }
  return map
}

function serializeCart(cart: Map<string, number>): string {
  const entries: string[] = []
  for (const [id, qty] of cart) {
    if (qty > 0) {
      entries.push(`${id}:${qty}`)
    }
  }
  return entries.join(',')
}

export const Route = createFileRoute('/')({
  validateSearch: cartSchema,
  loaderDeps({ search: { cart } }) {
    return { cart }
  },
  component: IndexPage,
})

function IndexPage() {
  const { cart: cartStr } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: products } = useSuspenseQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  const cartItems = parseCart(cartStr)

  const updateCart = (productId: string, quantity: number) => {
    const newCart = new Map(cartItems)
    if (quantity <= 0) {
      newCart.delete(productId)
    } else {
      newCart.set(productId, quantity)
    }
    const serialized = serializeCart(newCart)
    navigate({
      search: (prev) => ({
        ...prev,
        cart: serialized || undefined,
      }),
      replace: true,
    })
  }

  const addToCart = (productId: string) => {
    const currentQty = cartItems.get(productId) ?? 0
    updateCart(productId, currentQty + 1)
  }

  const removeFromCart = (productId: string) => {
    updateCart(productId, 0)
  }

  const setQuantity = (productId: string, quantity: number) => {
    updateCart(productId, quantity)
  }

  const cartTotal = Array.from(cartItems.entries()).reduce((total, [id, qty]) => {
    const product = products.find((p) => p.id === id)
    return total + (product?.price ?? 0) * qty
  }, 0)

  const cartProducts: (Product & { quantity: number })[] = Array.from(cartItems.entries())
    .map(([id, qty]) => {
      const product = products.find((p) => p.id === id)
      return product ? { ...product, quantity: qty } : null
    })
    .filter(Boolean) as (Product & { quantity: number })[]

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🛒 E-Commerce Store</h1>
      </header>
      <main className="app-main">
        <section className="products-section">
          <h2>Products</h2>
          <div className="products-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                cartQuantity={cartItems.get(product.id) ?? 0}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        </section>
        <aside className="cart-section">
          <CartDisplay
            items={cartProducts}
            total={cartTotal}
            onRemove={removeFromCart}
            onSetQuantity={setQuantity}
          />
        </aside>
      </main>
    </div>
  )
}
