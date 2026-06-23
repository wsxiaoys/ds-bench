import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useNavigate,
  useSearch,
  Outlet,
} from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchProducts } from './api';
import type { Product } from './api';
import {
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  AlertTriangle,
  Sparkles,
  Check,
} from 'lucide-react';
import { useState } from 'react';

// Define structures
interface CartItem {
  id: number;
  quantity: number;
}

interface CartSearch {
  cart?: CartItem[];
}

// Root Route
const rootRoute = createRootRoute({
  component: () => (
    <div id="root">
      <header className="header">
        <div className="header-content">
          <a href="/" className="logo">
            <ShoppingBag className="logo-icon" />
            <span>TanShop</span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
            <span>TanStack Powered</span>
          </div>
        </div>
      </header>
      <main style={{ flexGrow: 1 }}>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="app-container text-center">
          <p>© {new Date().getFullYear()} TanShop. Built with TanStack Query & TanStack Router.</p>
        </div>
      </footer>
    </div>
  ),
});

// Index Component (Main shopping page)
function IndexComponent() {
  const search = useSearch({ from: '/' }) as CartSearch;
  const navigate = useNavigate({ from: '/' });
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // TanStack Query for products
  const { data: products, isLoading, error } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const cart = search.cart || [];

  // Helper to update the cart search parameter
  const updateCart = (newCart: CartItem[]) => {
    setCheckoutSuccess(false); // Reset checkout success state on cart interaction
    navigate({
      search: (prev) => ({
        ...prev,
        cart: newCart.length > 0 ? newCart : undefined, // clean up empty cart from URL
      }),
    });
  };

  // Add item to cart
  const handleAddToCart = (productId: number) => {
    const existingIndex = cart.findIndex((item) => item.id === productId);
    if (existingIndex > -1) {
      const newCart = [...cart];
      newCart[existingIndex] = {
        ...newCart[existingIndex],
        quantity: newCart[existingIndex].quantity + 1,
      };
      updateCart(newCart);
    } else {
      updateCart([...cart, { id: productId, quantity: 1 }]);
    }
  };

  // Update item quantity
  const handleUpdateQuantity = (productId: number, delta: number) => {
    const existingIndex = cart.findIndex((item) => item.id === productId);
    if (existingIndex > -1) {
      const newCart = [...cart];
      const newQuantity = newCart[existingIndex].quantity + delta;
      if (newQuantity <= 0) {
        // Remove item if quantity goes to 0 or less
        newCart.splice(existingIndex, 1);
      } else {
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: newQuantity,
        };
      }
      updateCart(newCart);
    }
  };

  // Remove item from cart
  const handleRemoveFromCart = (productId: number) => {
    const newCart = cart.filter((item) => item.id !== productId);
    updateCart(newCart);
  };

  // Clear cart
  const handleClearCart = () => {
    updateCart([]);
  };

  // Calculate cart details
  const cartItemsDetails = cart
    .map((item) => {
      const product = products?.find((p) => p.id === item.id);
      if (!product) return null;
      return {
        product,
        quantity: item.quantity,
        subtotal: product.price * item.quantity,
      };
    })
    .filter((item): item is { product: Product; quantity: number; subtotal: number } => item !== null);

  const totalItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = cartItemsDetails.reduce((acc, item) => acc + item.subtotal, 0);

  const handleCheckout = () => {
    setCheckoutSuccess(true);
    updateCart([]); // Clear cart in URL
  };

  return (
    <div className="app-container">
      <div className="main-layout">
        {/* Products Section */}
        <div className="products-section">
          <h2 className="section-title">
            <Sparkles size={20} style={{ color: 'var(--primary)' }} />
            <span>Our Products</span>
          </h2>

          {isLoading && (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Fetching amazing products for you...</p>
            </div>
          )}

          {error && (
            <div className="error-container">
              <AlertTriangle size={40} />
              <h3>Failed to load products</h3>
              <p>{(error as Error).message || "An unexpected error occurred."}</p>
            </div>
          )}

          {products && (
            <div className="products-grid">
              {products.map((product) => {
                const cartItem = cart.find((item) => item.id === product.id);
                return (
                  <div className="product-card" key={product.id}>
                    <div className="product-image-container">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="product-image"
                        loading="lazy"
                      />
                      <span className="product-category">{product.category}</span>
                    </div>
                    <div className="product-info">
                      <h3 className="product-name">{product.name}</h3>
                      <p className="product-desc">{product.description}</p>
                      <div className="product-footer">
                        <span className="product-price">${product.price.toFixed(2)}</span>
                        <button
                          className={`btn ${cartItem ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => handleAddToCart(product.id)}
                        >
                          {cartItem ? (
                            <>
                              <Check size={16} />
                              <span>In Cart ({cartItem.quantity})</span>
                            </>
                          ) : (
                            <>
                              <ShoppingCart size={16} />
                              <span>Add to Cart</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart Section */}
        <div className="cart-section">
          <div className="cart-header">
            <h3 className="cart-title">
              <ShoppingCart size={20} />
              <span>Shopping Cart</span>
            </h3>
            {totalItemsCount > 0 && (
              <span className="cart-badge">{totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}</span>
            )}
          </div>

          {checkoutSuccess && (
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 'var(--radius-sm)',
              padding: '16px',
              color: '#15803d',
              textAlign: 'center',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Check size={24} style={{ color: '#16a34a' }} />
              <h4 style={{ margin: 0, fontWeight: 700 }}>Order Placed!</h4>
              <p style={{ margin: 0, fontSize: '13px' }}>Thank you for your purchase. Your cart has been cleared.</p>
            </div>
          )}

          {cartItemsDetails.length === 0 ? (
            <div className="cart-empty">
              <ShoppingBag className="cart-empty-icon" />
              <p style={{ fontWeight: 600, margin: 0 }}>Your cart is empty</p>
              <p style={{ fontSize: '13px', margin: 0 }}>Add products from the left to start shopping!</p>
            </div>
          ) : (
            <>
              <div className="cart-items-list">
                {cartItemsDetails.map(({ product, quantity }) => (
                  <div className="cart-item" key={product.id}>
                    <img src={product.image} alt={product.name} className="cart-item-image" />
                    <div className="cart-item-details">
                      <h4 className="cart-item-name">{product.name}</h4>
                      <div className="cart-item-price">
                        ${product.price.toFixed(2)} x {quantity}
                      </div>
                    </div>
                    <div className="cart-item-controls">
                      <button
                        className="btn-icon"
                        onClick={() => handleUpdateQuantity(product.id, -1)}
                        aria-label="Decrease quantity"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="quantity-display">{quantity}</span>
                      <button
                        className="btn-icon"
                        onClick={() => handleUpdateQuantity(product.id, 1)}
                        aria-label="Increase quantity"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        className="btn-icon"
                        style={{ color: 'var(--danger)', marginLeft: '4px' }}
                        onClick={() => handleRemoveFromCart(product.id)}
                        aria-label="Remove item"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cart-summary">
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Shipping</span>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>FREE</span>
                </div>
                <div className="summary-row summary-total">
                  <span>Total</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                  <button className="btn btn-danger" onClick={handleClearCart}>
                    <Trash2 size={16} />
                    <span>Clear</span>
                  </button>
                  <button className="btn btn-primary" onClick={handleCheckout}>
                    <span>Checkout</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Create Route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): CartSearch => {
    const rawCart = search.cart;
    if (!rawCart) {
      return { cart: [] };
    }

    // If it is already parsed as an array
    if (Array.isArray(rawCart)) {
      const validated = rawCart
        .map((item: any) => {
          if (item && typeof item === 'object') {
            const id = Number(item.id);
            const quantity = Number(item.quantity);
            if (!isNaN(id) && !isNaN(quantity)) {
              return { id, quantity };
            }
          }
          return null;
        })
        .filter((item): item is CartItem => item !== null);
      return { cart: validated };
    }

    // If it's a JSON string in raw URL format
    if (typeof rawCart === 'string') {
      try {
        const parsed = JSON.parse(rawCart);
        if (Array.isArray(parsed)) {
          const validated = parsed
            .map((item: any) => {
              if (item && typeof item === 'object') {
                const id = Number(item.id);
                const quantity = Number(item.quantity);
                if (!isNaN(id) && !isNaN(quantity)) {
                  return { id, quantity };
                }
              }
              return null;
            })
            .filter((item): item is CartItem => item !== null);
          return { cart: validated };
        }
      } catch (e) {
        console.error('Failed to parse cart search param', e);
      }
    }

    return { cart: [] };
  },
  component: IndexComponent,
});

// Build Route Tree
const routeTree = rootRoute.addChildren([indexRoute]);

// Create Router
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Register Router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
