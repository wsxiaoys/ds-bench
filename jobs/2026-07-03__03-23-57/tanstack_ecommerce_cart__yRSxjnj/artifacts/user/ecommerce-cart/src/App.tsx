import React, { useState } from 'react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useNavigate,
  useSearch,
  Outlet,
} from '@tanstack/react-router'
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import {
  ShoppingBag,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Search,
  Sparkles,
  CheckCircle2,
  X,
} from 'lucide-react'
import { fetchProducts } from './products'
import type { CartItem, SearchParams } from './types'

// 1. Initialize TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
})

// 2. Define TanStack Router Route Tree
const rootRoute = createRootRoute({
  component: () => <RouterProviderContent />,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    return {
      cart: typeof search.cart === 'string' ? search.cart : undefined,
      category: typeof search.category === 'string' ? search.category : undefined,
      search: typeof search.search === 'string' ? search.search : undefined,
    }
  },
  component: ECommerceApp,
})

const routeTree = rootRoute.addChildren([indexRoute])

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// 3. Main Root Component
function RouterProviderContent() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-slate-50 text-slate-800 antialiased">
        {/* Render active route */}
        <Outlet />
      </div>
    </QueryClientProvider>
  )
}

// 4. E-commerce App Component (Index Route Component)
function ECommerceApp() {
  const searchParams = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })

  const [checkoutSuccess, setCheckoutSuccess] = useState(false)

  // Parse Cart State from URL
  const cartItems: CartItem[] = React.useMemo(() => {
    if (!searchParams.cart) return []
    try {
      return JSON.parse(searchParams.cart)
    } catch {
      return []
    }
  }, [searchParams.cart])

  // Fetch products using TanStack Query
  const { data: products = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  // Cart Operations
  const updateCartInUrl = (newCart: CartItem[]) => {
    navigate({
      search: (prev) => ({
        ...prev,
        cart: newCart.length > 0 ? JSON.stringify(newCart) : undefined,
      }),
    })
  }

  const addToCart = (productId: number) => {
    const existing = cartItems.find((item) => item.id === productId)
    let newCart: CartItem[]
    if (existing) {
      newCart = cartItems.map((item) =>
        item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
      )
    } else {
      newCart = [...cartItems, { id: productId, quantity: 1 }]
    }
    updateCartInUrl(newCart)
  }

  const removeFromCart = (productId: number) => {
    const newCart = cartItems.filter((item) => item.id !== productId)
    updateCartInUrl(newCart)
  }

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }
    const newCart = cartItems.map((item) =>
      item.id === productId ? { ...item, quantity } : item
    )
    updateCartInUrl(newCart)
  }

  const clearCart = () => {
    updateCartInUrl([])
  }

  // Filter Operations
  const setCategoryFilter = (category: string | undefined) => {
    navigate({
      search: (prev) => ({
        ...prev,
        category: category || undefined,
      }),
    })
  }

  const setSearchQuery = (query: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        search: query || undefined,
      }),
    })
  }

  // Derived State
  const categories = React.useMemo(() => {
    const cats = new Set(products.map((p) => p.category))
    return Array.from(cats)
  }, [products])

  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      const matchesCategory =
        !searchParams.category || p.category === searchParams.category
      const matchesSearch =
        !searchParams.search ||
        p.name.toLowerCase().includes(searchParams.search.toLowerCase()) ||
        p.description.toLowerCase().includes(searchParams.search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [products, searchParams.category, searchParams.search])

  // Cart Summary calculations
  const cartWithProductDetails = React.useMemo(() => {
    return cartItems
      .map((item) => {
        const product = products.find((p) => p.id === item.id)
        return {
          ...item,
          product,
        }
      })
      .filter((item) => item.product !== undefined) as Array<
      CartItem & { product: typeof products[0] }
    >
  }, [cartItems, products])

  const cartTotalItems = React.useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0)
  }, [cartItems])

  const cartSubtotal = React.useMemo(() => {
    return cartWithProductDetails.reduce(
      (acc, item) => acc + item.product.price * item.quantity,
      0
    )
  }, [cartWithProductDetails])

  const shippingCost = 0 // Free Shipping!
  const estimatedTax = cartSubtotal * 0.08 // 8% Tax
  const cartTotal = cartSubtotal + shippingCost + estimatedTax

  const handleCheckout = () => {
    setCheckoutSuccess(true)
    clearCart()
  }

  return (
    <div className="max-w-7xl mx-REDACTED px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <header className="border-b border-slate-200 pb-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-3xl">
              <ShoppingBag className="h-8 w-8" />
              <span>TanShop</span>
            </div>
            <p className="text-slate-500 mt-1">
              A modern e-commerce shopping cart built with{' '}
              <span className="font-semibold text-indigo-600">TanStack Query</span>{' '}
              and{' '}
              <span className="font-semibold text-indigo-600">TanStack Router</span>.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm text-indigo-800 max-w-md">
            <Sparkles className="h-5 w-5 text-indigo-500 shrink-0" />
            <p>
              <strong>URL State Enabled:</strong> Notice how the shopping cart items and quantities update the URL parameters in real-time. Try refreshing the page!
            </p>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Products Column */}
        <main className="lg:col-span-8">
          {/* Filters & Search */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="Search products..."
                value={searchParams.search || ''}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
              {searchParams.search && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Buttons */}
            <div className="flex flex-wrap gap-2 items-center w-full sm:w-REDACTED overflow-x-REDACTED pb-1 sm:pb-0">
              <button
                onClick={() => setCategoryFilter(undefined)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  !searchParams.category
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                    searchParams.category === cat
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
              <p className="text-slate-500 mt-4 font-medium">Loading products...</p>
            </div>
          ) : isError ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <p className="text-red-500 font-semibold text-lg">Failed to load products</p>
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Try Again
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <ShoppingBag className="h-12 w-12 text-slate-300 mx-REDACTED mb-4" />
              <p className="text-slate-500 font-medium text-lg">No products match your criteria.</p>
              <button
                onClick={() => {
                  setCategoryFilter(undefined)
                  setSearchQuery('')
                }}
                className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {filteredProducts.map((product) => {
                const cartItem = cartItems.find((item) => item.id === product.id)
                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col group hover:shadow-md transition-all duration-200"
                  >
                    {/* Image Container */}
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                        {product.category}
                      </span>
                      {cartItem && (
                        <span className="absolute top-3 right-3 bg-indigo-600 text-white text-xs font-bold h-6 w-6 rounded-full flex items-center justify-center shadow-md animate-bounce">
                          {cartItem.quantity}
                        </span>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {product.name}
                      </h3>
                      <p className="text-slate-500 text-sm mt-1.5 flex-1 line-clamp-2">
                        {product.description}
                      </p>
                      <div className="mt-5 flex items-center justify-between">
                        <span className="text-2xl font-extrabold text-slate-900">
                          ${product.price.toFixed(2)}
                        </span>
                        <button
                          onClick={() => addToCart(product.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs hover:shadow-sm transition-all duration-150 active:scale-95"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add to Cart</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>

        {/* Cart Column */}
        <aside className="lg:col-span-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2 font-bold text-xl text-slate-900">
                <ShoppingCart className="h-6 w-6 text-slate-700" />
                <span>Shopping Cart</span>
              </div>
              {cartTotalItems > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear Cart</span>
                </button>
              )}
            </div>

            {/* Cart Body */}
            {cartItems.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-12 w-12 text-slate-300 mx-REDACTED mb-3" />
                <p className="text-slate-500 font-medium">Your cart is empty</p>
                <p className="text-slate-400 text-xs mt-1">Add items from the product catalog to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cart Items List */}
                <div className="max-h-96 overflow-y-REDACTED pr-1 divide-y divide-slate-100">
                  {cartWithProductDetails.map((item) => (
                    <div key={item.id} className="py-3 flex gap-3 group">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="h-14 w-14 rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-100"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-slate-900 truncate">
                          {item.product.name}
                        </h4>
                        <p className="text-indigo-600 text-xs font-bold mt-0.5">
                          ${item.product.price.toFixed(2)}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          {/* Quantity Selector */}
                          <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="p-1 hover:bg-slate-200 rounded-l-lg text-slate-500 transition-colors"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="px-2.5 text-xs font-bold text-slate-700 min-w-[20px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="p-1 hover:bg-slate-200 rounded-r-lg text-slate-500 transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          {/* Delete Item */}
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded-md transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pricing Summary */}
                <div className="border-t border-slate-100 pt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-800">${cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Shipping</span>
                    <span className="text-green-600 font-semibold">FREE</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Estimated Tax (8%)</span>
                    <span className="font-semibold text-slate-800">${estimatedTax.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-slate-100 pt-2.5 flex justify-between text-slate-900 font-bold text-base">
                    <span>Total</span>
                    <span className="text-indigo-600">${cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={handleCheckout}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md shadow-indigo-100 hover:shadow-lg hover:shadow-indigo-200 transition-all duration-150 mt-4 active:scale-98"
                >
                  Proceed to Checkout
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Checkout Success Modal */}
      {checkoutSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-REDACTED mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Order Placed Successfully!</h3>
            <p className="text-slate-500 text-sm mt-2">
              Thank you for your purchase. Your order has been processed and is on its way!
            </p>
            <button
              onClick={() => setCheckoutSuccess(false)}
              className="mt-6 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm transition"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// 5. Router Instance Export
export default function App() {
  return <RouterProvider router={router} />
}
