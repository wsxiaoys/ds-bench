import type { Product } from '../lib/mock-data'

interface CartDisplayProps {
  items: (Product & { quantity: number })[]
  total: number
  onRemove: (productId: string) => void
  onSetQuantity: (productId: string, quantity: number) => void
}

export function CartDisplay({ items, total, onRemove, onSetQuantity }: CartDisplayProps) {
  return (
    <div className="cart-panel">
      <h2>🛒 Shopping Cart</h2>
      {items.length === 0 ? (
        <p className="cart-empty">Your cart is empty.</p>
      ) : (
        <>
          <ul className="cart-items">
            {items.map((item) => (
              <li key={item.id} className="cart-item">
                <span className="cart-item-icon">{item.image}</span>
                <div className="cart-item-details">
                  <span className="cart-item-name">{item.name}</span>
                  <span className="cart-item-price">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
                <div className="cart-item-controls">
                  <button
                    className="btn-qty"
                    onClick={() => onSetQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                  >
                    −
                  </button>
                  <span className="cart-item-qty">{item.quantity}</span>
                  <button
                    className="btn-qty"
                    onClick={() => onSetQuantity(item.id, item.quantity + 1)}
                  >
                    +
                  </button>
                  <button
                    className="btn-remove"
                    onClick={() => onRemove(item.id)}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="cart-total">
            <strong>Total: ${total.toFixed(2)}</strong>
          </div>
        </>
      )}
    </div>
  )
}
