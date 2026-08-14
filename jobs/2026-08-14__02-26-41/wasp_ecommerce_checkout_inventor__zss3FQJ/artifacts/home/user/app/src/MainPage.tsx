import { useState } from "react";
import { useQuery, getProducts, validateCoupon, checkout } from "wasp/client/operations";
import "./Main.css";

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

export function MainPage() {
  const { data: products, isLoading, error } = useQuery(getProducts);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");
  const [checkoutStatus, setCheckoutStatus] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Add product to cart
  const handleAddToCart = (product: any) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { id: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
  };

  // Adjust cart item quantity
  const handleUpdateQuantity = (productId: number, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  // Apply Coupon
  const handleApplyCoupon = async () => {
    setCouponError("");
    setCouponSuccess("");
    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }
    try {
      const coupon = await validateCoupon({ code: couponCode });
      setAppliedCoupon(coupon);
      setCouponSuccess(`Coupon "${coupon.code}" applied successfully!`);
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponError(err.message || "Invalid coupon code");
    }
  };

  // Place Order
  const handleCheckout = async () => {
    setCheckoutStatus("");
    if (cart.length === 0) {
      setCheckoutStatus("Your cart is empty");
      return;
    }
    setIsCheckingOut(true);
    try {
      const orderItems = cart.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      }));
      const result = await checkout({
        items: orderItems,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      });
      setCheckoutStatus(`Order placed successfully! Order ID: ${result.id}`);
      setCart([]);
      setCouponCode("");
      setAppliedCoupon(null);
      setCouponSuccess("");
    } catch (err: any) {
      setCheckoutStatus(err.message || "An error occurred during checkout");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = appliedCoupon
    ? appliedCoupon.type === "PERCENT"
      ? subtotal * (appliedCoupon.value / 100)
      : appliedCoupon.value
    : 0;
  const actualDiscount = Math.min(subtotal, discountAmount);
  const grandTotal = Math.max(0, subtotal - actualDiscount);

  if (isLoading) {
    return <div className="loading">Loading product catalog...</div>;
  }

  if (error) {
    return <div className="error-screen">Error loading products: {error.message}</div>;
  }

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <h1>Wasp E-Commerce Checkout</h1>
        <p>Experience fast, robust checkout with inventory tracking & concurrency control</p>
      </header>

      <main className="main-grid">
        {/* Product Catalog */}
        <section className="catalog-section">
          <h2>Product Catalog</h2>
          <div className="product-list">
            {products?.map((product: any) => (
              <div key={product.id} className="product-card">
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p className="product-price">${product.price.toFixed(2)}</p>
                  <p className={`product-stock ${product.inventory === 0 ? "out-of-stock" : ""}`}>
                    {product.inventory > 0 ? `${product.inventory} available` : "Out of Stock"}
                  </p>
                </div>
                <button
                  onClick={() => handleAddToCart(product)}
                  disabled={product.inventory <= 0}
                  className="add-to-cart-btn"
                >
                  {product.inventory > 0 ? "Add to Cart" : "Out of Stock"}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Shopping Cart & Checkout */}
        <section className="cart-section">
          <h2>Your Cart</h2>

          {cart.length === 0 ? (
            <p className="empty-cart-msg">Your cart is empty. Add some products to start!</p>
          ) : (
            <div className="cart-container">
              <div className="cart-items-list">
                {cart.map((item) => (
                  <div key={item.id} className="cart-item-row">
                    <div className="cart-item-details">
                      <span className="cart-item-name">{item.name}</span>
                      <span className="cart-item-price">${item.price.toFixed(2)} each</span>
                    </div>
                    <div className="cart-item-controls">
                      <button onClick={() => handleUpdateQuantity(item.id, -1)} className="qty-btn">-</button>
                      <span className="cart-item-qty">{item.quantity}</span>
                      <button onClick={() => handleUpdateQuantity(item.id, 1)} className="qty-btn">+</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coupon Section */}
              <div className="coupon-box">
                <label htmlFor="coupon-input">Have a coupon?</label>
                <div className="coupon-input-group">
                  <input
                    id="coupon-input"
                    type="text"
                    placeholder="Enter Coupon Code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                  />
                  <button id="apply-coupon-btn" onClick={handleApplyCoupon}>
                    Apply Coupon
                  </button>
                </div>
                {couponError && <p className="coupon-message error-msg">{couponError}</p>}
                {couponSuccess && <p className="coupon-message success-msg">{couponSuccess}</p>}
              </div>

              {/* Pricing Summary */}
              <div className="summary-box">
                <div className="summary-row">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {actualDiscount > 0 && (
                  <div className="summary-row discount-row">
                    <span>Discount:</span>
                    <span>-${actualDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="summary-row total-row">
                  <span>Grand Total:</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout Section */}
              <div className="checkout-box">
                <button
                  id="checkout-btn"
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="checkout-btn"
                >
                  {isCheckingOut ? "Processing..." : "Place Order"}
                </button>
                {checkoutStatus && (
                  <p
                    className={`checkout-message ${
                      checkoutStatus.includes("successfully") ? "success-msg" : "error-msg"
                    }`}
                  >
                    {checkoutStatus}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
