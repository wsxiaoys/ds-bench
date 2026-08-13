import { useState } from 'react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useNavigate,
  Outlet,
} from '@tanstack/react-router'
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  Check,
  Sparkles,
  RefreshCw,
  X,
  CreditCard,
  Gift,
  Search,
  Star,
  ArrowRight,
  ChevronRight
} from 'lucide-react'
import './App.css'

// ==========================================
// Types & Mock Data
// ==========================================
export interface Product {
  id: number
  name: string
  description: string
  price: number
  category: string
  rating: number
  image: string
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Aura Pro Noise-Canceling Headphones",
    description: "Immersive sound with hybrid active noise cancellation, 40h battery, and plush memory foam earcups.",
    price: 249.99,
    category: "Electronics",
    rating: 4.8,
    image: "🎧"
  },
  {
    id: 2,
    name: "Nomad Full-Grain Leather Wallet",
    description: "Handcrafted vegetable-tanned leather, RFID-blocking technology, and an ultra-slim pocket profile.",
    price: 49.99,
    category: "Accessories",
    rating: 4.6,
    image: "💼"
  },
  {
    id: 3,
    name: "Apex Mechanical Gaming Keyboard",
    description: "Ultra-responsive linear red switches, full RGB per-key backlighting, and aircraft-grade aluminum top plate.",
    price: 119.99,
    category: "Electronics",
    rating: 4.7,
    image: "⌨️"
  },
  {
    id: 4,
    name: "HydroFlow Insulated Water Bottle",
    description: "Double-walled stainless steel flask with a leak-proof straw lid. Keeps ice cold for up to 24 hours.",
    price: 34.99,
    category: "Fitness",
    rating: 4.5,
    image: "🍼"
  },
  {
    id: 5,
    name: "ErgoLift Premium Office Chair",
    description: "Advanced lumbar support system, breathable 3D mesh back, and multi-directional adjustable armrests.",
    price: 299.99,
    category: "Furniture",
    rating: 4.4,
    image: "🪑"
  },
  {
    id: 6,
    name: "PulseFit Smart Fitness Watch",
    description: "Heart rate monitor, blood oxygen tracker, sleep analysis, and built-in GPS with 14-day battery life.",
    price: 159.99,
    category: "Electronics",
    rating: 4.3,
    image: "⌚"
  },
  {
    id: 7,
    name: "EverGlow Smart LED Desk Lamp",
    description: "Stepless dimming, adjustable color temperature, wireless smartphone charging pad, and auto-off timer.",
    price: 59.99,
    category: "Furniture",
    rating: 4.6,
    image: "💡"
  },
  {
    id: 8,
    name: "Veloce Carbon Fiber Bicycle Helmet",
    description: "Aerodynamic design, multi-directional impact protection system (MIPS), and 18 high-flow cooling vents.",
    price: 89.99,
    category: "Fitness",
    rating: 4.9,
    image: "🪖"
  }
]

// Mock API call
const fetchProducts = async (): Promise<Product[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_PRODUCTS)
    }, 600)
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  }
})

// ==========================================
// TanStack Router Setup
// ==========================================
interface CartItem {
  id: number
  quantity: number
}

interface CartSearch {
  cartList: CartItem[]
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): CartSearch => {
    const cartStr = search.cart as string | undefined
    if (!cartStr) {
      return { cartList: [] }
    }
    try {
      const parsed = JSON.parse(cartStr)
      if (Array.isArray(parsed)) {
        const cartList = parsed
          .map((item: any) => {
            if (item && typeof item === 'object' && 'id' in item && 'quantity' in item) {
              const id = Number(item.id)
              const quantity = Number(item.quantity)
              if (!isNaN(id) && !isNaN(quantity) && quantity > 0) {
                return { id, quantity }
              }
            }
            return null
          })
          .filter((item): item is CartItem => item !== null)
        return { cartList }
      }
    } catch (e) {
      console.error("Failed to parse cart URL search parameter", e)
    }
    return { cartList: [] }
  },
  component: ECommerceApp,
})

const routeTree = rootRoute.addChildren([indexRoute])
const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// ==========================================
// Main E-Commerce Component
// ==========================================
function ECommerceApp() {
  const { cartList } = indexRoute.useSearch()
  const navigate = useNavigate()

  // State for client-side search & filter
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isCheckoutSuccess, setIsCheckoutSuccess] = useState<boolean>(false)

  // Fetch products via TanStack Query
  const { data: products = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  // Helper to update the cart state in the URL
  const updateCartInUrl = (newCart: CartItem[]) => {
    navigate({
      to: '/',
      search: (prev) => ({
        ...prev,
        cart: newCart.length > 0 ? JSON.stringify(newCart) : undefined,
      }),
    })
  }

  // Cart operations
  const handleAddToCart = (productId: number) => {
    const existingItem = cartList.find((item) => item.id === productId)
    if (existingItem) {
      const updated = cartList.map((item) =>
        item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
      )
      updateCartInUrl(updated)
    } else {
      const updated = [...cartList, { id: productId, quantity: 1 }]
      updateCartInUrl(updated)
    }
  }

  const handleUpdateQuantity = (productId: number, change: number) => {
    const updated = cartList
      .map((item) => {
        if (item.id === productId) {
          const newQty = item.quantity + change
          return { ...item, quantity: newQty }
        }
        return item
      })
      .filter((item) => item.quantity > 0)
    updateCartInUrl(updated)
  }

  const handleRemoveFromCart = (productId: number) => {
    const updated = cartList.filter((item) => item.id !== productId)
    updateCartInUrl(updated)
  }

  const handleClearCart = () => {
    updateCartInUrl([])
  }

  const handleCheckout = () => {
    setIsCheckoutSuccess(true)
  }

  const closeCheckoutSuccess = () => {
    setIsCheckoutSuccess(false)
    handleClearCart()
  }

  // Filter products based on category and search query
  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Get categories from products (excluding duplicates)
  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))]

  // Calculate cart metrics
  const cartWithProductDetails = cartList
    .map((cartItem) => {
      const product = products.find((p) => p.id === cartItem.id)
      return product ? { ...product, quantity: cartItem.quantity } : null
    })
    .filter((item): item is Product & { quantity: number } => item !== null)

  const cartItemsCount = cartList.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cartWithProductDetails.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.08 // 8% tax
  const shipping = subtotal > 150 || subtotal === 0 ? 0 : 9.99 // Free shipping over $150
  const total = subtotal + tax + shipping

  return (
    <div className="store-container">
      {/* Top Banner */}
      <div className="promo-banner">
        <span>🎉 Free shipping on orders over $150!</span>
      </div>

      {/* Header */}
      <header className="store-header">
        <div className="header-logo">
          <div className="logo-icon">🛒</div>
          <div>
            <h1>SwiftCart</h1>
            <p className="logo-tagline">TanStack Powered E-Commerce</p>
          </div>
        </div>

        <div className="header-actions">
          <button className="refetch-btn" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`btn-icon ${isFetching ? 'spin' : ''}`} size={16} />
            {isFetching ? 'Refetching...' : 'Sync Products'}
          </button>
          
          <div className="cart-indicator">
            <ShoppingCart size={20} />
            <span className="cart-indicator-badge">{cartItemsCount}</span>
            <span className="cart-indicator-total">${total.toFixed(2)}</span>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="store-layout">
        {/* Products Column */}
        <section className="products-section">
          {/* Controls Bar */}
          <div className="controls-bar">
            {/* Search Input */}
            <div className="search-wrapper">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')}>
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Category Tabs */}
            <div className="category-tabs">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Products List / States */}
          {isLoading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Fetching curated products for you...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <p className="error-msg">Failed to load products. Please check your connection.</p>
              <button className="retry-btn" onClick={() => refetch()}>
                Retry Now
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-products-container">
              <div className="empty-emoji">🔍</div>
              <h3>No products found</h3>
              <p>Try adjusting your search filters or category selection.</p>
              <button
                className="reset-filters-btn"
                onClick={() => {
                  setSelectedCategory('All')
                  setSearchQuery('')
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="products-grid">
              {filteredProducts.map((product) => {
                const cartItem = cartList.find((item) => item.id === product.id)
                const quantityInCart = cartItem?.quantity || 0

                return (
                  <div className="product-card" key={product.id}>
                    <div className="product-card-image">
                      <span className="product-emoji" role="img" aria-label={product.name}>
                        {product.image}
                      </span>
                      <span className="product-category-badge">{product.category}</span>
                    </div>

                    <div className="product-card-content">
                      <div className="product-rating">
                        <Star className="star-icon" size={14} fill="currentColor" />
                        <span>{product.rating}</span>
                      </div>
                      <h3 className="product-title">{product.name}</h3>
                      <p className="product-desc">{product.description}</p>
                    </div>

                    <div className="product-card-footer">
                      <span className="product-price">${product.price.toFixed(2)}</span>
                      
                      {quantityInCart > 0 ? (
                        <div className="quantity-controller-mini">
                          <button
                            onClick={() => handleUpdateQuantity(product.id, -1)}
                            className="qty-btn-mini"
                            title="Decrease quantity"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="qty-val-mini">{quantityInCart}</span>
                          <button
                            onClick={() => handleAddToCart(product.id)}
                            className="qty-btn-mini"
                            title="Increase quantity"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(product.id)}
                          className="add-to-cart-btn"
                        >
                          <Plus size={16} className="btn-icon" />
                          Add to Cart
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Sidebar Cart Column */}
        <aside className="cart-sidebar">
          <div className="cart-sidebar-header">
            <div className="cart-title-wrapper">
              <ShoppingCart size={20} className="cart-icon" />
              <h2>Shopping Cart</h2>
            </div>
            {cartList.length > 0 && (
              <button className="clear-cart-btn" onClick={handleClearCart}>
                <Trash2 size={14} className="btn-icon" />
                Clear
              </button>
            )}
          </div>

          <div className="cart-sidebar-body">
            {cartWithProductDetails.length === 0 ? (
              <div className="cart-empty-state">
                <div className="cart-empty-icon">🛍️</div>
                <h3>Your cart is empty</h3>
                <p>Explore our shop and add products to start your order!</p>
                <div className="cart-tips">
                  <div className="tip-item">
                    <Sparkles size={14} className="tip-icon" />
                    <span>Get free shipping on orders over $150</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="cart-items-list">
                {cartWithProductDetails.map((item) => (
                  <div className="cart-item-card" key={item.id}>
                    <div className="cart-item-thumbnail">{item.image}</div>
                    <div className="cart-item-info">
                      <h4 className="cart-item-name">{item.name}</h4>
                      <div className="cart-item-price-row">
                        <span className="cart-item-unit-price">${item.price.toFixed(2)}</span>
                        <span className="cart-item-subtotal-price">
                          Subtotal: ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                      <div className="cart-item-actions">
                        <div className="quantity-controller">
                          <button
                            onClick={() => handleUpdateQuantity(item.id, -1)}
                            className="qty-btn"
                            title="Decrease quantity"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="qty-val">{item.quantity}</span>
                          <button
                            onClick={() => handleAddToCart(item.id)}
                            className="qty-btn"
                            title="Increase quantity"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="remove-item-btn"
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cartWithProductDetails.length > 0 && (
            <div className="cart-sidebar-footer">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Estimated Tax (8%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>
                  Shipping
                  {shipping === 0 && <span className="shipping-free-badge">FREE</span>}
                </span>
                <span>{shipping === 0 ? '$0.00' : `$${shipping.toFixed(2)}`}</span>
              </div>

              {shipping > 0 && (
                <div className="shipping-progress">
                  <div className="shipping-progress-text">
                    <span>Add <strong>${(150 - subtotal).toFixed(2)}</strong> more for free shipping!</span>
                  </div>
                  <div className="shipping-progress-bar">
                    <div
                      className="shipping-progress-fill"
                      style={{ width: `${Math.min((subtotal / 150) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="summary-total-row">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>

              <button className="checkout-btn" onClick={handleCheckout}>
                <CreditCard size={18} className="btn-icon" />
                Proceed to Checkout
                <ArrowRight size={16} className="arrow-icon" />
              </button>
            </div>
          )}
        </aside>
      </main>

      {/* Checkout Success Modal */}
      {isCheckoutSuccess && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="success-icon">🎉</div>
            <h2>Order Placed Successfully!</h2>
            <p className="success-tagline">Thank you for shopping with SwiftCart.</p>

            <div className="order-receipt">
              <div className="receipt-header">Order Summary</div>
              <div className="receipt-items">
                {cartWithProductDetails.map((item) => (
                  <div className="receipt-item" key={item.id}>
                    <span>
                      {item.image} {item.name} (x{item.quantity})
                    </span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="receipt-divider"></div>
              <div className="receipt-total-row">
                <span>Total Paid</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <p className="modal-notice">
              The URL has been cleared of cart parameters, resetting your shopping state.
            </p>

            <button className="modal-close-btn" onClick={closeCheckoutSuccess}>
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="store-footer-legal">
        <p>© 2026 SwiftCart. All rights reserved. Powered by TanStack Query & TanStack Router.</p>
      </footer>
    </div>
  )
}

// ==========================================
// Root Application Component wrapper
// ==========================================
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
