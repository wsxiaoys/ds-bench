import type { Product } from '../lib/mock-data'

interface ProductCardProps {
  product: Product
  cartQuantity: number
  onAddToCart: (productId: string) => void
}

export function ProductCard({ product, cartQuantity, onAddToCart }: ProductCardProps) {
  return (
    <div className="product-card">
      <div className="product-image">{product.image}</div>
      <div className="product-info">
        <h3>{product.name}</h3>
        <p className="product-description">{product.description}</p>
        <p className="product-price">${product.price.toFixed(2)}</p>
        <div className="product-actions">
          <button
            className="btn-add"
            onClick={() => onAddToCart(product.id)}
          >
            Add to Cart {cartQuantity > 0 && `(${cartQuantity})`}
          </button>
        </div>
      </div>
    </div>
  )
}
