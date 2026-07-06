import type { Product } from '../products'

type Props = {
  product: Product
  quantity: number
  onAdd: () => void
}

export function ProductCard({ product, quantity, onAdd }: Props) {
  return (
    <div className="card">
      <div className="card-image">{product.image}</div>
      <div className="card-body">
        <span className="card-category">{product.category}</span>
        <h3 className="card-name">{product.name}</h3>
        <p className="card-desc">{product.description}</p>
        <div className="card-footer">
          <span className="card-price">${product.price.toFixed(2)}</span>
          <button
            className="btn btn-primary"
            onClick={onAdd}
            disabled={quantity > 0}
          >
            {quantity > 0 ? `In cart (${quantity})` : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}