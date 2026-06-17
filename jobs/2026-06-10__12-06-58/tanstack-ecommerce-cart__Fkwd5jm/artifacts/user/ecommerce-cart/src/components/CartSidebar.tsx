import { useQuery } from '@tanstack/react-query'
import { fetchProducts } from '../data/products'
import { useCart } from '../hooks/useCart'

export function CartSidebar() {
  const { cart, removeItem, setQuantity, clearCart, totalItems } = useCart()
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  const cartDetails = cart
    .map((item) => {
      const product = products.find((p) => p.id === item.id)
      if (!product) return null
      return { ...item, product, subtotal: item.qty * product.price }
    })
    .filter(Boolean) as Array<{
    id: number
    qty: number
    product: (typeof products)[0]
    subtotal: number
  }>

  const total = cartDetails.reduce((sum, item) => sum + item.subtotal, 0)
  const isEmpty = cart.length === 0

  return (
    <aside className="cart-sidebar">
      <div className="cart-header">
        <h2 className="cart-title">
          🛒 Your Cart
          {totalItems > 0 && (
            <span className="cart-badge">{totalItems}</span>
          )}
        </h2>
        {!isEmpty && (
          <button className="clear-btn" onClick={clearCart}>
            Clear All
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="cart-empty">
          <div className="cart-empty-icon">🛍️</div>
          <p>Your cart is empty</p>
          <p className="cart-empty-sub">Add some products to get started!</p>
        </div>
      ) : (
        <>
          <ul className="cart-items">
            {cartDetails.map((item) => (
              <li key={item.id} className="cart-item">
                <span className="cart-item-emoji">{item.product.image}</span>
                <div className="cart-item-info">
                  <p className="cart-item-name">{item.product.name}</p>
                  <p className="cart-item-price">
                    ${item.product.price.toFixed(2)} × {item.qty}
                  </p>
                </div>
                <div className="cart-item-controls">
                  <div className="qty-row">
                    <button
                      className="qty-btn-sm"
                      onClick={() => setQuantity(item.id, item.qty - 1)}
                    >
                      −
                    </button>
                    <span className="qty-value-sm">{item.qty}</span>
                    <button
                      className="qty-btn-sm"
                      onClick={() => setQuantity(item.id, item.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                  <p className="cart-item-subtotal">
                    ${item.subtotal.toFixed(2)}
                  </p>
                  <button
                    className="remove-btn-sm"
                    onClick={() => removeItem(item.id)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="cart-summary">
            <div className="summary-row">
              <span>Subtotal ({totalItems} item{totalItems !== 1 ? 's' : ''})</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Shipping</span>
              <span className="free-shipping">FREE</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-row total-row">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <button className="checkout-btn">
              Checkout →
            </button>
            <p className="url-hint">
              💡 Cart state is saved in the URL – try refreshing!
            </p>
          </div>
        </>
      )}
    </aside>
  )
}
