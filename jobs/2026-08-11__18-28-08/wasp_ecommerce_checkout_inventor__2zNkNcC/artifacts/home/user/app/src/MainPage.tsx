import { useState } from "react";
import { useQuery, getProducts, getCoupon, checkout } from "wasp/client/operations";
import "./Main.css";

export function MainPage() {
  const { data: products, isLoading, error: productsError } = useQuery(getProducts);

  const [cart, setCart] = useState<Array<{
    productId: number;
    name: string;
    price: number;
    quantity: number;
  }>>([]);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponMessage, setCouponMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const addToCart = (product: any) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.productId === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [
          ...prevCart,
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
          },
        ];
      }
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  };

  const handleApplyCoupon = async () => {
    setCouponMessage(null);
    if (!couponCode.trim()) {
      setCouponMessage({ text: "Please enter a coupon code", isError: true });
      return;
    }
    try {
      const coupon = await getCoupon({ code: couponCode });
      setAppliedCoupon(coupon);
      setCouponMessage({ text: `Coupon "${coupon.code}" applied successfully!`, isError: false });
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponMessage({ text: err.message || "Invalid coupon code", isError: true });
    }
  };

  const handlePlaceOrder = async () => {
    setCheckoutMessage(null);
    if (cart.length === 0) {
      setCheckoutMessage({ text: "Your cart is empty", isError: true });
      return;
    }
    try {
      const result = await checkout({
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      });
      setCheckoutMessage({
        text: `Order placed successfully! Order ID: ${result.orderId}`,
        isError: false,
      });
      // Clear cart and coupon state on success
      setCart([]);
      setAppliedCoupon(null);
      setCouponCode("");
      setCouponMessage(null);
    } catch (err: any) {
      setCheckoutMessage({
        text: err.message || "An error occurred during checkout",
        isError: true,
      });
    }
  };

  // Calculate prices
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === "percentage") {
      discount = subtotal * (appliedCoupon.value / 100);
    } else if (appliedCoupon.type === "flat") {
      discount = appliedCoupon.value;
    }
  }
  discount = Math.min(subtotal, discount);
  const grandTotal = subtotal - discount;

  return (
    <div className="app-container">
      <header className="header">
        <h1>Wasp E-Commerce</h1>
        <p>Checkout with Inventory Tracking and Concurrency</p>
      </header>

      <main className="main-content">
        <section className="catalog-section">
          <h2>Product Catalog</h2>
          {isLoading && <p>Loading products...</p>}
          {productsError && <p className="error-message">Error loading products: {productsError.message}</p>}
          {products && products.length === 0 && <p>No products available.</p>}
          
          <div className="product-grid">
            {products && products.map((product: any) => (
              <div key={product.id} className="product-card">
                <h3>{product.name}</h3>
                <p className="product-price">${product.price.toFixed(2)}</p>
                <p className="product-inventory">
                  Available: <span className="inventory-count">{product.inventory}</span>
                </p>
                <button
                  onClick={() => addToCart(product)}
                  disabled={product.inventory <= 0}
                  className="add-to-cart-btn"
                >
                  {product.inventory > 0 ? "Add to Cart" : "Out of Stock"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="cart-section">
          <h2>Shopping Cart</h2>
          {cart.length === 0 ? (
            <p className="empty-cart-msg">Your cart is empty.</p>
          ) : (
            <div className="cart-container">
              <ul className="cart-items-list">
                {cart.map((item) => (
                  <li key={item.productId} className="cart-item">
                    <div className="cart-item-info">
                      <span className="cart-item-name">{item.name}</span>
                      <span className="cart-item-price">${item.price.toFixed(2)} each</span>
                    </div>
                    <div className="cart-item-actions">
                      <button onClick={() => updateQuantity(item.productId, -1)}>-</button>
                      <span className="cart-item-quantity">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, 1)}>+</button>
                      <button onClick={() => removeFromCart(item.productId)} className="remove-btn">Remove</button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="coupon-container">
                <input
                  id="coupon-input"
                  type="text"
                  placeholder="Enter Coupon Code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="coupon-input-field"
                />
                <button
                  id="apply-coupon-btn"
                  onClick={handleApplyCoupon}
                  className="apply-coupon-btn"
                >
                  Apply Coupon
                </button>
              </div>

              {couponMessage && (
                <p className={`coupon-msg ${couponMessage.isError ? "error" : "success"}`}>
                  {couponMessage.text}
                </p>
              )}

              <div className="cart-summary">
                <div className="summary-row">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Discount:</span>
                  <span>-${discount.toFixed(2)}</span>
                </div>
                <div className="summary-row grand-total">
                  <span>Grand Total:</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                id="checkout-btn"
                onClick={handlePlaceOrder}
                className="checkout-btn"
              >
                Place Order
              </button>

              {checkoutMessage && (
                <div className={`checkout-msg ${checkoutMessage.isError ? "error" : "success"}`}>
                  {checkoutMessage.text}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
