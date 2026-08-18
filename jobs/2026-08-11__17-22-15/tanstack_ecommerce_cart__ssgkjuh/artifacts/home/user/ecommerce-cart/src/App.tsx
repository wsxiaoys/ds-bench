import { useState } from 'react'
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useNavigate,
  useSearch,
  Outlet,
} from '@tanstack/react-router'
import { fetchProducts, type Product } from './products'
import { 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingCart, 
  CheckCircle,
  Tag,
  Sparkles,
  ArrowRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react'

// Define the cart item schema
interface CartItem {
  productId: number;
  quantity: number;
}

// Define the route search parameters schema
interface CartSearch {
  cart?: CartItem[];
}

// Create the root route
const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

// Create the index route with search param validation for the shopping cart
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): CartSearch => {
    let cart: CartItem[] = [];
    if (search.cart) {
      if (Array.isArray(search.cart)) {
        cart = search.cart as CartItem[];
      } else if (typeof search.cart === 'string') {
        try {
          const parsed = JSON.parse(search.cart);
          if (Array.isArray(parsed)) {
            cart = parsed;
          }
        } catch (e) {
          // Ignore parsing issues and fallback to empty
        }
      }
    }
    
    // Ensure the structure matches CartItem and filter out invalid values
    return {
      cart: cart
        .map((item: any) => ({
          productId: Number(item?.productId),
          quantity: Number(item?.quantity),
        }))
        .filter(
          (item) =>
            !isNaN(item.productId) &&
            !isNaN(item.quantity) &&
            item.quantity > 0
        ),
    };
  },
  component: Dashboard,
})

// Main Dashboard Component
function Dashboard() {
  const navigate = useNavigate({ from: '/' });
  const { cart = [] } = useSearch({ from: '/' });
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [purchasedItems, setPurchasedItems] = useState<{ name: string; quantity: number; price: number }[]>([]);
  const [purchasedTotal, setPurchasedTotal] = useState(0);

  // Fetch products using TanStack Query
  const { data: products, isLoading, isError, error, refetch } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Handler to add a product to the cart
  const handleAddToCart = (productId: number) => {
    const existing = cart.find((item) => item.productId === productId);
    let newCart: CartItem[];
    if (existing) {
      newCart = cart.map((item) =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      newCart = [...cart, { productId, quantity: 1 }];
    }

    navigate({
      search: (prev) => ({
        ...prev,
        cart: newCart,
      }),
    });
  };

  // Handler to update quantity of a cart item
  const handleUpdateQuantity = (productId: number, quantity: number) => {
    let newCart: CartItem[];
    if (quantity <= 0) {
      newCart = cart.filter((item) => item.productId !== productId);
    } else {
      newCart = cart.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      );
    }

    navigate({
      search: (prev) => ({
        ...prev,
        cart: newCart.length > 0 ? newCart : undefined, // clean up search param if empty
      }),
    });
  };

  // Handler to remove a product from the cart completely
  const handleRemoveFromCart = (productId: number) => {
    const newCart = cart.filter((item) => item.productId !== productId);
    navigate({
      search: (prev) => ({
        ...prev,
        cart: newCart.length > 0 ? newCart : undefined,
      }),
    });
  };

  // Handler to clear the entire cart
  const handleClearCart = () => {
    navigate({
      search: (prev) => ({
        ...prev,
        cart: undefined,
      }),
    });
  };

  // Handler for Checkout
  const handleCheckout = () => {
    if (cart.length === 0 || !products) return;

    // Compile checkout receipt details
    const receipt = cart.map((item) => {
      const prod = products.find((p) => p.id === item.productId);
      return {
        name: prod ? prod.name : `Product #${item.productId}`,
        quantity: item.quantity,
        price: prod ? prod.price : 0,
      };
    });

    const subtotal = receipt.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    setPurchasedItems(receipt);
    setPurchasedTotal(total);
    setCheckoutSuccess(true);

    // Clear the cart in URL state upon checkout
    handleClearCart();
  };

  // Helper to resolve product details from ID
  const getProductDetails = (id: number): Product | undefined => {
    return products?.find((p) => p.id === id);
  };

  // Cart statistics
  const cartTotalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = products
    ? cart.reduce((sum, item) => {
        const prod = getProductDetails(item.productId);
        return sum + (prod ? prod.price * item.quantity : 0);
      }, 0)
    : 0;
  const cartTax = cartSubtotal * 0.08;
  const cartTotal = cartSubtotal + cartTax;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 m-0 leading-none">TanCart</h1>
              <p className="text-xs text-slate-500 mt-0.5">E-commerce with TanStack</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative flex items-center bg-slate-100 hover:bg-slate-200 transition px-4 py-2 rounded-full cursor-pointer">
              <ShoppingCart className="h-5 w-5 text-slate-700 mr-2" />
              <span className="font-semibold text-sm text-slate-800">Cart</span>
              {cartTotalQuantity > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white animate-pulse">
                  {cartTotalQuantity}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 md:p-8 text-white shadow-lg mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="h-3 w-3" /> State in URL
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white m-0">The URL is Your Single Source of Truth</h2>
            <p className="text-indigo-100 text-sm md:text-base max-w-xl">
              Add products, adjust quantities, and watch the URL search parameters update in real-time. Share or refresh the URL to retain your exact shopping cart.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 text-xs font-mono max-w-full overflow-x-auto select-all">
            <span className="text-indigo-200">URL Query:</span> {window.location.search || "?cart=empty"}
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Products List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 m-0">Featured Products</h2>
              <button 
                onClick={() => refetch()} 
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 transition"
                title="Refetch products using TanStack Query"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refetch
              </button>
            </div>

            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 animate-pulse">
                    <div className="bg-slate-200 rounded-xl h-48 w-full" />
                    <div className="space-y-2">
                      <div className="bg-slate-200 h-4 w-1/4 rounded" />
                      <div className="bg-slate-200 h-6 w-3/4 rounded" />
                      <div className="bg-slate-200 h-4 w-full rounded" />
                      <div className="bg-slate-200 h-4 w-2/3 rounded" />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="bg-slate-200 h-6 w-1/4 rounded" />
                      <div className="bg-slate-200 h-10 w-1/3 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isError && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
                <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
                <h3 className="text-lg font-bold text-rose-800 m-0">Failed to load products</h3>
                <p className="text-sm text-rose-600">{(error as Error)?.message || "An unexpected error occurred."}</p>
                <button 
                  onClick={() => refetch()} 
                  className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
                >
                  Retry Loading
                </button>
              </div>
            )}

            {products && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {products.map((product) => {
                  const cartItem = cart.find((item) => item.productId === product.id);
                  const quantityInCart = cartItem?.quantity || 0;

                  return (
                    <div 
                      key={product.id} 
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition duration-200 flex flex-col group"
                    >
                      {/* Product Image */}
                      <div className="relative h-48 overflow-hidden bg-slate-100">
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                          loading="lazy"
                        />
                        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs">
                          <Tag className="h-3.5 w-3.5 text-indigo-600" />
                          <span className="text-xs font-semibold text-slate-700">{product.category}</span>
                        </div>
                      </div>

                      {/* Product Details */}
                      <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                        <div className="space-y-1.5">
                          <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition leading-snug m-0">
                            {product.name}
                          </h3>
                          <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                            {product.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <span className="text-2xl font-extrabold text-slate-900">
                            ${product.price.toFixed(2)}
                          </span>

                          {quantityInCart > 0 ? (
                            <div className="flex items-center bg-indigo-50 border border-indigo-100 rounded-xl p-1 shadow-2xs">
                              <button 
                                onClick={() => handleUpdateQuantity(product.id, quantityInCart - 1)}
                                className="p-1.5 hover:bg-white rounded-lg text-indigo-600 transition"
                                title="Decrease quantity"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="px-3 font-bold text-sm text-indigo-900">
                                {quantityInCart}
                              </span>
                              <button 
                                onClick={() => handleAddToCart(product.id)}
                                className="p-1.5 hover:bg-white rounded-lg text-indigo-600 transition"
                                title="Increase quantity"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleAddToCart(product.id)}
                              className="bg-slate-900 hover:bg-indigo-600 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs"
                            >
                              <Plus className="h-4 w-4" /> Add to Cart
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Shopping Cart Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-24 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900 m-0">Your Cart</h2>
                </div>
                {cart.length > 0 && (
                  <button 
                    onClick={handleClearCart}
                    className="text-xs font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear All
                  </button>
                )}
              </div>

              {/* Cart Content */}
              {cart.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="bg-slate-100 text-slate-400 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto">
                    <ShoppingCart className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 m-0">Your cart is empty</h3>
                  <p className="text-xs text-slate-500 max-w-[200px] mx-auto">
                    Browse our featured products and add them to your cart.
                  </p>
                </div>
              ) : (
                <>
                  {/* Cart Items List */}
                  <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                    {cart.map((item) => {
                      const product = getProductDetails(item.productId);
                      if (!product) return null;

                      return (
                        <div key={item.productId} className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <img 
                            src={product.image} 
                            alt={product.name} 
                            className="w-12 h-12 object-cover rounded-lg bg-slate-200 flex-shrink-0"
                          />
                          <div className="flex-grow min-w-0 flex flex-col justify-between">
                            <div className="flex justify-between items-start gap-1">
                              <h4 className="text-xs font-bold text-slate-900 truncate m-0 leading-tight">
                                {product.name}
                              </h4>
                              <button 
                                onClick={() => handleRemoveFromCart(item.productId)}
                                className="text-slate-400 hover:text-rose-500 p-0.5 transition"
                                title="Remove item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs font-semibold text-slate-500">
                                ${product.price.toFixed(2)}
                              </span>
                              
                              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs scale-90 origin-right">
                                <button 
                                  onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                                  className="p-1 hover:bg-slate-100 rounded text-slate-600 transition"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="px-2 font-bold text-xs text-slate-800">
                                  {item.quantity}
                                endLine: 
                                </span>
                                <button 
                                  onClick={() => handleAddToCart(item.productId)}
                                  className="p-1 hover:bg-slate-100 rounded text-slate-600 transition"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pricing Summary */}
                  <div className="border-t border-slate-100 pt-4 space-y-2.5 text-sm">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal</span>
                      <span className="font-semibold text-slate-800">${cartSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Estimated Tax (8%)</span>
                      <span className="font-semibold text-slate-800">${cartTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Shipping</span>
                      <span className="font-semibold text-emerald-600">FREE</span>
                    </div>
                    <div className="border-t border-slate-100 pt-3 flex justify-between text-base font-bold text-slate-900">
                      <span>Total</span>
                      <span className="text-lg text-indigo-600">${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <button 
                    onClick={handleCheckout}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition duration-150 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Proceed to Checkout <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Checkout Success Modal / Overlay */}
      {checkoutSuccess && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-4">
              <div className="bg-emerald-50 text-emerald-500 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                <CheckCircle className="h-10 w-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 m-0">Order Confirmed!</h2>
              <p className="text-sm text-slate-500">
                Thank you for your purchase. Your order has been placed successfully and is being processed.
              </p>
            </div>

            {/* Receipt Summary */}
            <div className="my-6 bg-slate-50 rounded-xl p-4 border border-slate-100 max-h-[220px] overflow-y-auto">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Order Receipt</h4>
              <div className="space-y-2">
                {purchasedItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-slate-600 truncate max-w-[250px]">
                      {item.name} <span className="text-slate-400">x{item.quantity}</span>
                    </span>
                    <span className="font-semibold text-slate-800">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-2.5 mt-2.5 flex justify-between font-bold text-slate-900 text-base">
                  <span>Total Paid</span>
                  <span className="text-indigo-600">${purchasedTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setCheckoutSuccess(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Build the route tree
const routeTree = rootRoute.addChildren([indexRoute])

// Create the router instance
const router = createRouter({ routeTree })

// Register the router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Initialize Query Client
const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
