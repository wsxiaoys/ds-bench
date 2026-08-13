import { useState } from "react";
import { getProducts, getCoupon, useQuery } from "wasp/client/operations";
import { checkout } from "wasp/client/operations";
import "./Main.css";

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export function MainPage() {
  const { data: products, isLoading, error: productsError } = useQuery(getProducts);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);

  const [couponMessage, setCouponMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const addToCart = (product: any) => {
    setCheckoutMessage(null);

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.inventory) {
          setCheckoutMessage({
            text: `Cannot add more. Insufficient inventory for ${product.name}.`,
            isError: true,
          });
          return prevCart;
        }
        return prevCart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        if (product.inventory <= 0) {
          setCheckoutMessage({
            text: `Out of stock: ${product.name} is currently unavailable.`,
            isError: true,
          });
          return prevCart;
        }
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

  const removeFromCart = (productId: string) => {
    setCart((prevCart) =>
      prevCart
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItemCompletely = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  };

  const handleApplyCoupon = async () => {
    setCouponMessage(null);
    if (!couponInput.trim()) {
      setCouponMessage({ text: "Please enter a coupon code", isError: true });
      return;
    }

    try {
      const coupon = await getCoupon({ code: couponInput.trim() });
      if (coupon) {
        setAppliedCoupon(coupon);
        setCouponMessage({
          text: `Coupon "${coupon.code}" applied successfully! (${coupon.type === "PERCENT" ? `${coupon.value}% off` : `$${coupon.value} off`})`,
          isError: false,
        });
      } else {
        setAppliedCoupon(null);
        setCouponMessage({ text: "Invalid coupon code", isError: true });
      }
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponMessage({
        text: err.message || "Error applying coupon code",
        isError: true,
      });
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setCheckoutMessage({ text: "Your cart is empty", isError: true });
      return;
    }

    setCheckoutMessage({ text: "Processing checkout...", isError: false });

    try {
      const items = cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      const res = await checkout({
        items,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      });

      setCheckoutMessage({
        text: `Order placed successfully! Order ID: ${res.orderId}`,
        isError: false,
      });

      // Clear states on success
      setCart([]);
      setAppliedCoupon(null);
      setCouponInput("");
      setCouponMessage(null);
    } catch (err: any) {
      setCheckoutMessage({
        text: err.message || "An error occurred during checkout",
        isError: true,
      });
    }
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === "PERCENT") {
      discount = subtotal * (appliedCoupon.value / 100);
    } else if (appliedCoupon.type === "FLAT") {
      discount = appliedCoupon.value;
    }
  }
  const grandTotal = Math.max(0, subtotal - discount);
  const finalDiscount = Math.min(subtotal, discount);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Wasp E-commerce Checkout</h1>
        <p className="subtitle">High-performance transaction-safe shopping cart</p>
      </header>

      <main className="main-grid">
        {/* Product Catalog Section */}
        <section className="catalog-section">
          <h2>Product Catalog</h2>
          {isLoading && <div className="loading">Loading products...</div>}
          {productsError && (
            <div className="error-banner">
              Failed to load products: {productsError.message || "Unknown error"}
            </div>
          )}

          {products && products.length === 0 && (
            <div className="empty-catalog">No products available.</div>
          )}

          {products && products.length > 0 && (
            <div className="products-list">
              {products.map((product) => (
                <div key={product.id} className="product-card">
                  <div className="product-info">
                    <h3>{product.name}</h3>
                    <p className="product-price">${product.price.toFixed(2)}</p>
                    <p className={`product-inventory ${product.inventory === 0 ? "out-of-stock" : ""}`}>
                      Available Inventory: <strong>{product.inventory}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => addToCart(product)}
                    disabled={product.inventory <= 0}
                    className="add-to-cart-btn"
                  >
                    {product.inventory <= 0 ? "Out of Stock" : "Add to Cart"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Shopping Cart & Checkout Section */}
        <section className="cart-section">
          <h2>Shopping Cart</h2>

          {cart.length === 0 ? (
            <div className="empty-cart-message">Your cart is empty. Add some items from the catalog!</div>
          ) : (
            <div className="cart-content">
              <div className="cart-items">
                {cart.map((item) => (
                  <div key={item.productId} className="cart-item">
                    <div className="cart-item-details">
                      <h4>{item.name}</h4>
                      <p>${item.price.toFixed(2)} each</p>
                    </div>
                    <div className="cart-item-actions">
                      <button onClick={() => removeFromCart(item.productId)} className="qty-btn">-</button>
                      <span className="qty-display">{item.quantity}</span>
                      <button
                        onClick={() => {
                          const prod = products?.find((p) => p.id === item.productId);
                          if (prod) {
                            addToCart(prod);
                          }
                        }}
                        className="qty-btn"
                      >
                        +
                      </button>
                      <button onClick={() => removeItemCompletely(item.productId)} className="delete-btn" title="Remove item">
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="coupon-container">
                <div className="coupon-input-group">
                  <input
                    id="coupon-input"
                    type="text"
                    placeholder="Enter Coupon Code"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    className="coupon-input"
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
                  <div className={`message-banner ${couponMessage.isError ? "error" : "success"}`}>
                    {couponMessage.text}
                  </div>
                )}
              </div>

              <div className="cart-summary">
                <div className="summary-row">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {finalDiscount > 0 && (
                  <div className="summary-row discount">
                    <span>Discount:</span>
                    <span>-${finalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="summary-row grand-total">
                  <span>Grand Total:</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="checkout-container">
                <button
                  id="checkout-btn"
                  onClick={handleCheckout}
                  className="checkout-btn"
                >
                  Place Order
                </button>

                {checkoutMessage && (
                  <div className={`message-banner ${checkoutMessage.isError ? "error" : "success"}`}>
                    {checkoutMessage.text}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
