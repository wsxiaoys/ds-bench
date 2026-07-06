import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchProducts } from './api/products';
import { decodeCart } from './cart';
import { ProductList } from './components/ProductList';
import { Cart } from './components/Cart';

export function App() {
  // Cart state is sourced directly from the URL search params via TanStack Router
  const search = useSearch({ from: '/' });
  const cart = decodeCart(search.cart);

  // Fetch products using TanStack Query
  const {
    data: products = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000,
  });

  const navigate = useNavigate({ from: '/' });

  const handleClearCart = () => {
    navigate({
      to: '/',
      search: (prev) => ({ ...prev, cart: undefined }),
      replace: true,
    });
  };

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>🛍️ TanStack Shop</h1>
          <p>Your cart state is fully stored in the URL — try refreshing!</p>
        </div>
        <div className="cart-summary-badge">
          🛒 {totalItems} {totalItems === 1 ? 'item' : 'items'}
        </div>
      </header>

      <div className="layout">
        <main>
          <ProductList
            products={products}
            cart={cart}
            isLoading={isLoading}
            error={error as Error | null}
          />
        </main>
        <Cart cart={cart} products={products} onClearCart={handleClearCart} />
      </div>
    </div>
  );
}