import React from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { fetchProducts } from './products';
import './App.css';

// Create a client for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Define CartItem and SearchParams interfaces
interface CartItem {
  productId: number;
  quantity: number;
}

interface ProductSearch {
  cart: CartItem[];
  category?: string;
  search?: string;
}

// Create a root route with search parameter validation
const rootRoute = createRootRoute({
  validateSearch: (search: Record<string, unknown>): ProductSearch => {
    let cart: CartItem[] = [];
    if (search.cart) {
      try {
        let parsed: any;
        if (typeof search.cart === 'string') {
          parsed = JSON.parse(search.cart);
        } else {
          parsed = search.cart;
        }
        if (Array.isArray(parsed)) {
          cart = parsed
            .map((item: any) => {
              const productId = Number(item?.productId ?? item?.id);
              const quantity = Number(item?.quantity);
              if (!isNaN(productId) && !isNaN(quantity) && quantity > 0) {
                return { productId, quantity };
              }
              return null;
            })
            .filter((item): item is CartItem => item !== null);
        }
      } catch (e) {
        console.error('Failed to parse cart search param', e);
      }
    }
    const category = typeof search.category === 'string' ? search.category : undefined;
    const searchQuery = typeof search.search === 'string' ? search.search : undefined;
    return { cart, category, search: searchQuery };
  },
  component: RootComponent,
});

// Header Component displaying a summary of the cart state
function HeaderCartSummary() {
  const search = useSearch({ from: rootRoute.id });
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const cart = search.cart;
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const totalPrice = cart.reduce((sum, item) => {
    const product = products?.find((p) => p.id === item.productId);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  return (
    <div className="header-cart-summary">
      <span>🛒 {totalItems} {totalItems === 1 ? 'item' : 'items'}</span>
      <span>•</span>
      <span>${totalPrice.toFixed(2)}</span>
    </div>
  );
}

function RootComponent() {
  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <span className="logo-emoji">🛒</span>
            <h1 className="app-title">TanStack Shop</h1>
          </div>
          <HeaderCartSummary />
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>© 2026 TanStack Shop. Built with TanStack Query & TanStack Router.</p>
      </footer>
    </div>
  );
}

// Create index route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexComponent,
});

function IndexComponent() {
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });

  // Fetch products using TanStack Query
  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const cart = search.cart;
  const activeCategory = search.category || 'All';
  const searchQuery = search.search || '';

  // Get unique categories from products
  const categories = React.useMemo(() => {
    if (!products) return ['All'];
    const unique = new Set(products.map((p) => p.category));
    return ['All', ...Array.from(unique)];
  }, [products]);

  // Filter products based on activeCategory and searchQuery
  const filteredProducts = React.useMemo(() => {
    if (!products) return [];
    return products.filter((product) => {
      const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, searchQuery]);

  const handleAddToCart = (productId: number) => {
    const existingItem = cart.find((item) => item.productId === productId);
    let newCart: CartItem[];
    if (existingItem) {
      newCart = cart.map((item) =>
        item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      newCart = [...cart, { productId, quantity: 1 }];
    }
    navigate({
      search: (prev) => ({ ...prev, cart: newCart }),
    });
  };

  const handleUpdateQuantity = (productId: number, newQuantity: number) => {
    let newCart: CartItem[];
    if (newQuantity <= 0) {
      newCart = cart.filter((item) => item.productId !== productId);
    } else {
      newCart = cart.map((item) =>
        item.productId === productId ? { ...item, quantity: newQuantity } : item
      );
    }
    navigate({
      search: (prev) => ({ ...prev, cart: newCart }),
    });
  };

  const handleRemoveFromCart = (productId: number) => {
    const newCart = cart.filter((item) => item.productId !== productId);
    navigate({
      search: (prev) => ({ ...prev, cart: newCart }),
    });
  };

  const handleClearCart = () => {
    navigate({
      search: (prev) => ({ ...prev, cart: [] }),
    });
  };

  const handleCategorySelect = (category: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        category: category === 'All' ? undefined : category,
      }),
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    navigate({
      search: (prev) => ({
        ...prev,
        search: val || undefined,
      }),
    });
  };

  // Calculate cart totals
  const subtotal = React.useMemo(() => {
    if (!products) return 0;
    return cart.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId);
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
  }, [cart, products]);

  const shipping = subtotal > 0 && subtotal < 150 ? 9.99 : 0;
  const total = subtotal + shipping;

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading the best products for you...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error Loading Products</h2>
        <p>{(error as Error).message || 'Something went wrong. Please try again later.'}</p>
      </div>
    );
  }

  return (
    <div className="shop-layout">
      {/* Left Column: Products List with Controls */}
      <div className="products-container">
        {/* Controls Bar: Search & Filters */}
        <div className="controls-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search products..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
          <div className="category-filters">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`filter-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => handleCategorySelect(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="no-results">
            <h3>No products found</h3>
            <p>Try adjusting your search or category filter.</p>
          </div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((product) => {
              const cartItem = cart.find((item) => item.productId === product.id);
              const quantityInCart = cartItem?.quantity || 0;

              return (
                <div key={product.id} className="product-card">
                  <div className="product-image-container">{product.image}</div>
                  <div className="product-info">
                    <span className="product-category">{product.category}</span>
                    <h3 className="product-name">{product.name}</h3>
                    <p className="product-description">{product.description}</p>
                    <div className="product-footer">
                      <span className="product-price">${product.price.toFixed(2)}</span>
                      <button
                        className="add-to-cart-btn"
                        onClick={() => handleAddToCart(product.id)}
                      >
                        Add to Cart {quantityInCart > 0 && `(${quantityInCart})`}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Shopping Cart Sidebar */}
      <div className="cart-sidebar">
        <div className="cart-title-row">
          <h2 className="cart-title">
            <span>🛒</span> Shopping Cart
          </h2>
          {cart.length > 0 && (
            <button className="clear-cart-btn" onClick={handleClearCart}>
              Clear All
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="cart-empty-state">
            <div className="cart-empty-emoji">🛍️</div>
            <p className="cart-empty-text">Your cart is empty</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Add some products to get started!
            </p>
          </div>
        ) : (
          <>
            <div className="cart-items-list">
              {cart.map((item) => {
                const product = products?.find((p) => p.id === item.productId);
                if (!product) return null;

                return (
                  <div key={item.productId} className="cart-item">
                    <div className="cart-item-image">{product.image}</div>
                    <div className="cart-item-details">
                      <h4 className="cart-item-name">{product.name}</h4>
                      <span className="cart-item-price">${product.price.toFixed(2)}</span>
                    </div>
                    <div className="cart-item-controls">
                      <div className="quantity-picker">
                        <button
                          className="qty-btn"
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                        >
                          -
                        </button>
                        <span className="qty-num">{item.quantity}</span>
                        <button
                          className="qty-btn"
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="remove-item-btn"
                        onClick={() => handleRemoveFromCart(item.productId)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="cart-summary-section">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Shipping</span>
                <span>
                  {shipping === 0 ? (
                    <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>FREE</span>
                  ) : (
                    `$${shipping.toFixed(2)}`
                  )}
                </span>
              </div>
              {shipping > 0 && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-light)',
                    marginBottom: '0.75rem',
                    textAlign: 'right',
                  }}
                >
                  Add ${(150 - subtotal).toFixed(2)} more for FREE shipping!
                </div>
              )}
              <div className="summary-row total">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>

              <button
                className="checkout-btn"
                onClick={() => {
                  alert(`Thank you for your order of $${total.toFixed(2)}!`);
                  handleClearCart();
                }}
              >
                Proceed to Checkout
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Build the route tree
const routeTree = rootRoute.addChildren([indexRoute]);

// Create the router
const router = createRouter({ routeTree });

// Register the router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
