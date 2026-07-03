import { useNavigate } from '@tanstack/react-router';
import type { Product } from '../types';
import type { CartItem } from '../types';
import { addToCart } from '../cart';

interface ProductListProps {
  products: Product[];
  cart: CartItem[];
  isLoading: boolean;
  error: Error | null;
}

export function ProductList({ products, cart, isLoading, error }: ProductListProps) {
  const navigate = useNavigate({ from: '/' });

  const handleAddToCart = (productId: number) => {
    const next = addToCart(cart, productId, 1);
    navigate({
      to: '/',
      search: (prev) => ({
        ...prev,
        cart: next.map((i) => `${i.id}:${i.qty}`).join(','),
      }),
      replace: false,
    });
  };

  if (isLoading) {
    return (
      <div className="loading">
        <p>⏳ Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <p>❌ Error loading products: {error.message}</p>
      </div>
    );
  }

  return (
    <section>
      <div className="section-title">
        <span>Products</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#718096' }}>
          {products.length} available
        </span>
      </div>
      <div className="product-list">
        {products.map((product) => {
          const inCart = cart.find((item) => item.id === product.id);
          return (
            <div key={product.id} className="product-card">
              <img
                className="product-image"
                src={product.image}
                alt={product.name}
                loading="lazy"
              />
              <div className="product-info">
                <div className="product-category">{product.category}</div>
                <div className="product-name">{product.name}</div>
                <div className="product-description">{product.description}</div>
                <div className="product-footer">
                  <span className="product-price">
                    ${product.price.toFixed(2)}
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleAddToCart(product.id)}
                    aria-label={`Add ${product.name} to cart`}
                  >
                    {inCart ? `Add (${inCart.qty})` : 'Add to Cart'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}