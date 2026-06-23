import type { Product } from "../api/products";
import type { CartState } from "../App";
import "./CartDisplay.css";

interface CartDisplayProps {
  products: Product[];
  cart: CartState;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemoveFromCart: (productId: number) => void;
}

export function CartDisplay({
  products,
  cart,
  onUpdateQuantity,
  onRemoveFromCart,
}: CartDisplayProps) {
  const cartEntries = Object.entries(cart).filter(([_, qty]) => qty > 0);

  const getProduct = (id: string) =>
    products.find((p) => p.id === Number(id));

  const total = cartEntries.reduce((sum, [id, qty]) => {
    const product = getProduct(id);
    return sum + (product ? product.price * qty : 0);
  }, 0);

  const totalItems = cartEntries.reduce((sum, [_, qty]) => sum + qty, 0);

  return (
    <div className="cart-display">
      <h2>
        🛒 Shopping Cart
        {totalItems > 0 && (
          <span className="cart-badge">{totalItems}</span>
        )}
      </h2>

      {cartEntries.length === 0 ? (
        <div className="cart-empty">
          <p>Your cart is empty</p>
          <p className="cart-empty-hint">Add some products to get started!</p>
        </div>
      ) : (
        <>
          <div className="cart-items">
            {cartEntries.map(([id, qty]) => {
              const product = getProduct(id);
              if (!product) return null;
              return (
                <div key={id} className="cart-item">
                  <div className="cart-item-info">
                    <span className="cart-item-emoji">{product.image}</span>
                    <div className="cart-item-details">
                      <span className="cart-item-name">{product.name}</span>
                      <span className="cart-item-price">
                        ${product.price.toFixed(2)} each
                      </span>
                    </div>
                  </div>
                  <div className="cart-item-actions">
                    <div className="quantity-controls">
                      <button
                        className="qty-btn"
                        onClick={() => onUpdateQuantity(product.id, qty - 1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="qty-value">{qty}</span>
                      <button
                        className="qty-btn"
                        onClick={() => onUpdateQuantity(product.id, qty + 1)}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <span className="cart-item-subtotal">
                      ${(product.price * qty).toFixed(2)}
                    </span>
                    <button
                      className="remove-btn"
                      onClick={() => onRemoveFromCart(product.id)}
                      aria-label={`Remove ${product.name}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="cart-footer">
            <div className="cart-total">
              <span>Total:</span>
              <span className="cart-total-amount">${total.toFixed(2)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}