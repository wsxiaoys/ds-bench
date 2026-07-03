import { useNavigate } from '@tanstack/react-router';
import type { Product } from '../types';
import type { CartItem } from '../types';
import { removeFromCart, updateCartItemQty } from '../cart';

interface CartProps {
  cart: CartItem[];
  products: Product[];
  onClearCart: () => void;
}

export function Cart({ cart, products, onClearCart }: CartProps) {
  const navigate = useNavigate({ from: '/' });

  // Build a lookup map of products by id for fast access
  const productMap = new Map(products.map((p) => [p.id, p]));

  const itemsWithProducts = cart
    .map((item) => ({
      item,
      product: productMap.get(item.id),
    }))
    .filter((entry): entry is { item: CartItem; product: Product } => Boolean(entry.product));

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = itemsWithProducts.reduce(
    (sum, { item, product }) => sum + product.price * item.qty,
    0
  );
  const shipping = subtotal > 0 && subtotal < 100 ? 9.99 : 0;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  const handleUpdateQty = (productId: number, delta: number) => {
    const current = cart.find((item) => item.id === productId);
    if (!current) return;
    const newQty = current.qty + delta;
    const next = updateCartItemQty(cart, productId, newQty);
    navigate({
      to: '/',
      search: (prev) => ({
        ...prev,
        cart: next.length > 0
          ? next.map((i) => `${i.id}:${i.qty}`).join(',')
          : undefined,
      }),
      replace: true,
    });
  };

  const handleRemove = (productId: number) => {
    const next = removeFromCart(cart, productId);
    navigate({
      to: '/',
      search: (prev) => ({
        ...prev,
        cart: next.length > 0
          ? next.map((i) => `${i.id}:${i.qty}`).join(',')
          : undefined,
      }),
      replace: true,
    });
  };

  return (
    <aside className="cart-panel">
      <div className="section-title">
        <span>Shopping Cart</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#718096' }}>
          {totalItems} {totalItems === 1 ? 'item' : 'items'}
        </span>
      </div>

      {cart.length === 0 ? (
        <div className="cart-empty">
          <div className="cart-empty-icon">🛒</div>
          <p>Your cart is empty</p>
          <p style={{ fontSize: 12, marginTop: 6 }}>
            Add products to get started!
          </p>
        </div>
      ) : (
        <>
          <div className="cart-items">
            {itemsWithProducts.map(({ item, product }) => (
              <div key={product.id} className="cart-item">
                <img
                  className="cart-item-image"
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                />
                <div className="cart-item-info">
                  <div className="cart-item-name">{product.name}</div>
                  <div className="cart-item-price">
                    ${product.price.toFixed(2)}
                  </div>
                </div>
                <div className="cart-item-controls">
                  <button
                    className="btn btn-icon"
                    onClick={() => handleUpdateQty(product.id, -1)}
                    aria-label={`Decrease quantity of ${product.name}`}
                  >
                    −
                  </button>
                  <span className="cart-item-qty">{item.qty}</span>
                  <button
                    className="btn btn-icon"
                    onClick={() => handleUpdateQty(product.id, 1)}
                    aria-label={`Increase quantity of ${product.name}`}
                  >
                    +
                  </button>
                  <button
                    className="cart-item-remove"
                    onClick={() => handleRemove(product.id)}
                    aria-label={`Remove ${product.name} from cart`}
                    title="Remove from cart"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <div className="cart-summary-row">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="cart-summary-row">
              <span>Shipping</span>
              <span>{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
            </div>
            <div className="cart-summary-row">
              <span>Tax (8%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="cart-summary-total">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="cart-actions">
            <button className="btn btn-primary">Checkout</button>
            <button className="btn btn-secondary" onClick={onClearCart}>
              Clear
            </button>
          </div>

          {subtotal < 100 && subtotal > 0 && (
            <div className="url-hint">
              <strong>💡 Free shipping</strong>
              Add ${(100 - subtotal).toFixed(2)} more to qualify for free shipping!
            </div>
          )}
        </>
      )}
    </aside>
  );
}