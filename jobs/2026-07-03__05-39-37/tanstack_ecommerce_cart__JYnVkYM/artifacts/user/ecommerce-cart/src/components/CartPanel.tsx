import type { CartLine } from '../cart'

type Props = {
  lines: CartLine[]
  total: number
  count: number
  onIncrement: (id: number) => void
  onDecrement: (id: number) => void
  onRemove: (id: number) => void
  onClear: () => void
}

export function CartPanel({
  lines,
  total,
  count,
  onIncrement,
  onDecrement,
  onRemove,
  onClear,
}: Props) {
  return (
    <div className="cart-panel">
      <div className="cart-panel-head">
        <h2>Your Cart</h2>
        <span className="muted">{count} item{count === 1 ? '' : 's'}</span>
      </div>

      {lines.length === 0 ? (
        <div className="cart-empty">
          <div className="cart-empty-icon">🧺</div>
          <p>Your cart is empty.</p>
          <p className="muted">Add some products to get started.</p>
        </div>
      ) : (
        <>
          <ul className="cart-list">
            {lines.map(({ product, quantity, subtotal }) => (
              <li className="cart-item" key={product.id}>
                <span className="cart-item-image">{product.image}</span>
                <div className="cart-item-info">
                  <span className="cart-item-name">{product.name}</span>
                  <span className="cart-item-price">
                    ${product.price.toFixed(2)} each
                  </span>
                </div>
                <div className="qty-controls">
                  <button
                    className="btn btn-icon"
                    onClick={() => onDecrement(product.id)}
                    aria-label={`Decrease ${product.name}`}
                  >
                    −
                  </button>
                  <span className="qty">{quantity}</span>
                  <button
                    className="btn btn-icon"
                    onClick={() => onIncrement(product.id)}
                    aria-label={`Increase ${product.name}`}
                  >
                    +
                  </button>
                </div>
                <span className="cart-item-subtotal">
                  ${subtotal.toFixed(2)}
                </span>
                <button
                  className="btn btn-remove"
                  onClick={() => onRemove(product.id)}
                  aria-label={`Remove ${product.name}`}
                  title="Remove"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <div className="cart-summary">
            <div className="cart-total-row">
              <span>Total</span>
              <span className="cart-total-value">${total.toFixed(2)}</span>
            </div>
            <button className="btn btn-secondary" onClick={onClear}>
              Clear cart
            </button>
          </div>
        </>
      )}
    </div>
  )
}