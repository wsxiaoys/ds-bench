import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { fetchProducts } from '../api'

type CartSearch = {
  cart: Record<string, number>
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): CartSearch => {
    let cart = search.cart
    if (typeof cart === 'string') {
      try {
        cart = JSON.parse(cart)
      } catch (e) {
        cart = {}
      }
    }
    return {
      cart: (cart as Record<string, number>) || {},
    }
  },
  component: Index,
})

function Index() {
  const { cart } = Route.useSearch()
  const navigate = Route.useNavigate()

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  const addToCart = (productId: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        cart: {
          ...prev.cart,
          [productId]: (prev.cart[productId] || 0) + 1,
        },
      }),
    })
  }

  const removeFromCart = (productId: string) => {
    navigate({
      search: (prev) => {
        const newCart = { ...prev.cart }
        delete newCart[productId]
        return {
          ...prev,
          cart: newCart,
        }
      },
    })
  }

  const updateQuantity = (productId: string, quantity: number) => {
    navigate({
      search: (prev) => {
        const newCart = { ...prev.cart }
        if (quantity <= 0) {
          delete newCart[productId]
        } else {
          newCart[productId] = quantity
        }
        return {
          ...prev,
          cart: newCart,
        }
      },
    })
  }

  if (isLoading) return <div>Loading products...</div>

  const cartItems = Object.entries(cart).map(([id, quantity]) => {
    const product = products?.find((p) => p.id === id)
    return { product, quantity }
  }).filter((item) => item.product)

  const cartTotal = cartItems.reduce((total, item) => {
    return total + (item.product?.price || 0) * item.quantity
  }, 0)

  return (
    <div style={{ display: 'flex', gap: '2rem', padding: '1rem' }}>
      <div style={{ flex: 1 }}>
        <h2>Products</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {products?.map((product) => (
            <div key={product.id} style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '4px' }}>
              <h3>{product.name}</h3>
              <p>${product.price.toFixed(2)}</p>
              <button onClick={() => addToCart(product.id)}>Add to Cart</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <h2>Shopping Cart</h2>
        {cartItems.length === 0 ? (
          <p>Your cart is empty.</p>
        ) : (
          <div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {cartItems.map(({ product, quantity }) => (
                <li key={product!.id} style={{ borderBottom: '1px solid #eee', paddingBottom: '1rem', marginBottom: '1rem' }}>
                  <h4>{product!.name}</h4>
                  <p>Price: ${product!.price.toFixed(2)}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button onClick={() => updateQuantity(product!.id, quantity - 1)}>-</button>
                    <span>{quantity}</span>
                    <button onClick={() => updateQuantity(product!.id, quantity + 1)}>+</button>
                    <button onClick={() => removeFromCart(product!.id)} style={{ marginLeft: '1rem', color: 'red' }}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
            <h3>Total: ${cartTotal.toFixed(2)}</h3>
          </div>
        )}
      </div>
    </div>
  )
}
