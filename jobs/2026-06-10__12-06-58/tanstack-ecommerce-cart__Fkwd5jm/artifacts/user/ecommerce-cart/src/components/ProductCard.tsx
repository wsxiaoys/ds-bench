import type { Product } from '../data/products'
import { useCart } from '../hooks/useCart'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const { cart, addItem, removeItem, setQuantity } = useCart()
  const cartItem = cart.find((i) => i.id === product.id)
  const inCart = !!cartItem

  return (
    <div className={`product-card ${inCart ? 'in-cart' : ''}`}>
      <div className="product-emoji">{product.image}</div>
      <div className="product-badge">{product.category}</div>
      <h3 className="product-name">{product.name}</h3>
      <p className="product-description">{product.description}</p>
      <div className="product-meta">
        <div className="product-rating">
          {'★'.repeat(Math.round(product.rating))}{'☆'.repeat(5 - Math.round(product.rating))}
          <span className="rating-value">{product.rating}</span>
        </div>
        <span className="product-stock">
          {product.stock <= 10 ? `Only ${product.stock} left!` : `${product.stock} in stock`}
        </span>
      </div>
      <div className="product-footer">
        <span className="product-price">${product.price.toFixed(2)}</span>
        {inCart ? (
          <div className="quantity-control">
            <button
              className="qty-btn"
              onClick={() => setQuantity(product.id, cartItem.qty - 1)}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="qty-value">{cartItem.qty}</span>
            <button
              className="qty-btn"
              onClick={() => setQuantity(product.id, cartItem.qty + 1)}
              aria-label="Increase quantity"
            >
              +
            </button>
            <button
              className="remove-btn"
              onClick={() => removeItem(product.id)}
              aria-label="Remove from cart"
              title="Remove"
            >
              🗑️
            </button>
          </div>
        ) : (
          <button className="add-btn" onClick={() => addItem(product.id)}>
            Add to Cart
          </button>
        )}
      </div>
    </div>
  )
}
