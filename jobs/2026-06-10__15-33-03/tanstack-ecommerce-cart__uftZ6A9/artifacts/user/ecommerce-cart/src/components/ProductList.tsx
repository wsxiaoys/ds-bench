import type { Product } from "../api/products";
import type { CartState } from "../App";
import "./ProductList.css";

interface ProductListProps {
  products: Product[];
  cart: CartState;
  onAddToCart: (productId: number) => void;
}

export function ProductList({ products, cart, onAddToCart }: ProductListProps) {
  return (
    <div className="product-list">
      <h2>Products</h2>
      <div className="products-grid">
        {products.map((product) => {
          const inCart = cart[String(product.id)] || 0;
          return (
            <div key={product.id} className="product-card">
              <div className="product-emoji">{product.image}</div>
              <h3>{product.name}</h3>
              <p className="product-description">{product.description}</p>
              <p className="product-price">${product.price.toFixed(2)}</p>
              <button
                className="add-to-cart-btn"
                onClick={() => onAddToCart(product.id)}
              >
                {inCart > 0 ? `Add Another (${inCart} in cart)` : "Add to Cart"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}