import React, { useState } from "react";
import { useQuery, getProducts, applyCoupon, checkout } from "wasp/client/operations";
import "./Main.css";

interface Product {
  id: number;
  name: string;
  price: number;
  inventory: number;
}

interface Coupon {
  id: number;
  code: string;
  type: string;
  value: number;
}

export function MainPage() {
  const { data: products, isLoading, error, refetch } = useQuery(getProducts);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  if (isLoading) {
    return <div className="loading">Loading products...</div>;
  }

  if (error) {
    return <div className="error">Error loading products: {error.message || String(error)}</div>;
  }

  const productList: Product[] = products || [];

  // Cart operations
  const addToCart = (productId: number) => {
    const product = productList.find((p) => p.id === productId);
    if (!product) return;

    setCart((prev) => {
      const currentQty = prev[productId] || 0;
      if (currentQty >= product.inventory) {
        setCheckoutError(`Cannot add more. Only ${product.inventory} available.`);
        return prev;
      }
      setCheckoutError(null);
      return {
        ...prev,
        [productId]: currentQty + 1,
      };
    });
  };

  const updateQuantity = (productId: number, qty: number) => {
    const product = productList.find((p) => p.id === productId);
    if (!product) return;

    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (qty > product.inventory) {
      setCheckoutError(`Cannot exceed available inventory of ${product.inventory}.`);
      return;
    }

    setCheckoutError(null);
    setCart((prev) => ({
      ...prev,
      [productId]: qty,
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => {
      const updated = { ...prev };
      delete updated[productId];
      return updated;
    });
  };

  // Calculations
  const subtotal = productList.reduce((acc, product) => {
    const qty = cart[product.id] || 0;
    return acc + product.price * qty;
  }, 0);

  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === "PERCENTAGE") {
      discount = subtotal * (appliedCoupon.value / 100.0);
    } else if (appliedCoupon.type === "FLAT") {
      discount = appliedCoupon.value;
    }
  }

  const grandTotal = Math.max(0, subtotal - discount);

  // Apply Coupon
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponMessage(null);
    setCouponError(null);

    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }

    try {
      const coupon = await applyCoupon({ code: couponCode });
      setAppliedCoupon(coupon);
      setCouponMessage(`Coupon "${coupon.code}" applied successfully!`);
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponError(err.message || "Invalid coupon code");
    }
  };

  // Place Order
  const handlePlaceOrder = async () => {
    setCheckoutMessage(null);
    setCheckoutError(null);

    const items = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => ({
        productId: parseInt(productId, 10),
        quantity: qty,
      }));

    if (items.length === 0) {
      setCheckoutError("Your cart is empty");
      return;
    }

    setIsCheckingOut(true);
    try {
      const result = await checkout({
        items,
        couponCode: appliedCoupon?.code,
      });

      setCheckoutMessage(`Order placed successfully! Order ID: ${result.orderId}`);
      setCart({});
      setAppliedCoupon(null);
      setCouponCode("");
      setCouponMessage(null);
      await refetch();
    } catch (err: any) {
      const errMsg = err.message || String(err);
      if (errMsg.toLowerCase().includes("inventory") || errMsg.toLowerCase().includes("stock")) {
        setCheckoutError("Insufficient inventory. Out of stock.");
      } else {
        setCheckoutError(errMsg);
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  const cartItems = productList.filter((p) => (cart[p.id] || 0) > 0);

  return (
    <div className="app-container">
      <header className="header">
        <h1>Wasp E-Commerce</h1>
      </header>

      <div className="main-content">
        {/* Product Catalog */}
        <section className="catalog-section">
          <h2>Product Catalog</h2>
          <div className="products-grid">
            {productList.map((product) => (
              <div key={product.id} className="product-card">
                <h3>{product.name}</h3>
                <p className="price">${product.price.toFixed(2)}</p>
                <p className="inventory">Available Inventory: {product.inventory}</p>
                <button
                  onClick={() => addToCart(product.id)}
                  disabled={product.inventory === 0}
                  className="add-to-cart-btn"
                >
                  {product.inventory === 0 ? "Out of Stock" : "Add to Cart"}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Shopping Cart */}
        <section className="cart-section">
          <h2>Your Shopping Cart</h2>
          {cartItems.length === 0 ? (
            <p className="empty-cart-text">Your cart is empty. Add some products!</p>
          ) : (
            <div className="cart-content">
              <div className="cart-items">
                {cartItems.map((product) => {
                  const qty = cart[product.id] || 0;
                  return (
                    <div key={product.id} className="cart-item">
                      <div className="item-info">
                        <h4>{product.name}</h4>
                        <p>${product.price.toFixed(2)} each</p>
                      </div>
                      <div className="item-actions">
                        <button onClick={() => updateQuantity(product.id, qty - 1)} className="qty-btn">-</button>
                        <span className="qty-display">{qty}</span>
                        <button onClick={() => updateQuantity(product.id, qty + 1)} className="qty-btn">+</button>
                        <button onClick={() => removeFromCart(product.id)} className="remove-btn">Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Coupon Form */}
              <form onSubmit={handleApplyCoupon} className="coupon-form">
                <input
                  id="coupon-input"
                  type="text"
                  placeholder="Enter Coupon Code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="coupon-input"
                />
                <button id="apply-coupon-btn" type="submit" className="apply-coupon-btn">
                  Apply Coupon
                </button>
              </form>

              {couponMessage && <p className="coupon-success">{couponMessage}</p>}
              {couponError && <p className="coupon-error">{couponError}</p>}

              {/* Order Summary */}
              <div className="order-summary">
                <div className="summary-line">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {appliedCoupon && (
                  <div className="summary-line discount-line">
                    <span>Discount ({appliedCoupon.code}):</span>
                    <span>-${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="summary-line total-line">
                  <span>Grand Total:</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Place Order */}
              <button
                id="checkout-btn"
                onClick={handlePlaceOrder}
                disabled={isCheckingOut}
                className="checkout-btn"
              >
                {isCheckingOut ? "Placing Order..." : "Place Order"}
              </button>
            </div>
          )}

          {checkoutMessage && <p className="checkout-success">{checkoutMessage}</p>}
          {checkoutError && <p className="checkout-error">{checkoutError}</p>}
        </section>
      </div>
    </div>
  );
}
