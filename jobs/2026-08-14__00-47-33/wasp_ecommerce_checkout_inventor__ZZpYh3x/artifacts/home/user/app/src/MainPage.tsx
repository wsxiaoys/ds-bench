import { useQuery, getProducts } from "wasp/client/operations";
import { applyCoupon, checkout } from "wasp/client/operations";
import { useState } from "react";
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
  type: "PERCENTAGE" | "FLAT";
  value: number;
}

export function MainPage() {
  const { data: products, isLoading, error: productsError } = useQuery(getProducts);

  // Cart state: map of productId -> quantity
  const [cart, setCart] = useState<Record<number, number>>({});
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  
  const [couponMessage, setCouponMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const currentQty = prev[product.id] || 0;
      return {
        ...prev,
        [product.id]: currentQty + 1,
      };
    });
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart((prev) => {
      const newCart = { ...prev };
      delete newCart[productId];
      return newCart;
    });
  };

  const updateQuantity = (productId: number, qty: number) => {
    if (qty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    setCart((prev) => ({
      ...prev,
      [productId]: qty,
    }));
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponMessage(null);

    if (!couponCode.trim()) {
      setCouponMessage({ text: "Please enter a coupon code", isError: true });
      return;
    }

    try {
      const coupon = await applyCoupon({ code: couponCode.trim() });
      setAppliedCoupon(coupon);
      setCouponMessage({ text: "Coupon applied successfully!", isError: false });
    } catch (err: any) {
      setAppliedCoupon(null);
      const errMsg = err.message || "Invalid coupon code";
      setCouponMessage({ text: errMsg, isError: true });
    }
  };

  const handleCheckout = async () => {
    setCheckoutMessage(null);
    setIsSubmitting(true);

    const cartItems = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({
        productId: parseInt(id, 10),
        quantity: qty,
      }));

    if (cartItems.length === 0) {
      setCheckoutMessage({ text: "Your cart is empty.", isError: true });
      setIsSubmitting(false);
      return;
    }

    try {
      const order = await checkout({
        items: cartItems,
        couponCode: appliedCoupon?.code,
      });

      setCheckoutMessage({
        text: `Order placed successfully! Order ID: ${order.id}`,
        isError: false,
      });
      // Clear cart and coupon state on success
      setCart({});
      setCouponCode("");
      setAppliedCoupon(null);
      setCouponMessage(null);
    } catch (err: any) {
      const errMsg = err.message || "Checkout failed";
      // Ensure we display "Insufficient inventory" or "Out of stock" clearly on inventory failure
      setCheckoutMessage({ text: errMsg, isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculations
  const cartItemsList = products
    ? Object.entries(cart)
        .map(([id, qty]) => {
          const product = products.find((p: Product) => p.id === parseInt(id, 10));
          return product ? { product, quantity: qty } : null;
        })
        .filter((item): item is { product: Product; quantity: number } => item !== null)
    : [];

  const subtotal = cartItemsList.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === "PERCENTAGE") {
      discount = subtotal * (appliedCoupon.value / 100);
    } else if (appliedCoupon.type === "FLAT") {
      discount = appliedCoupon.value;
    }
    if (discount > subtotal) {
      discount = subtotal;
    }
  }

  const total = subtotal - discount;

  return (
    <div className="ecommerce-container">
      <header className="header">
        <h1>Wasp E-Commerce Checkout</h1>
      </header>

      {productsError && (
        <div className="error-banner">
          Error loading products: {productsError.message || "Unknown error"}
        </div>
      )}

      {isLoading ? (
        <div className="loading">Loading products...</div>
      ) : (
        <div className="main-layout">
          {/* Product Catalog Section */}
          <section className="catalog-section">
            <h2>Product Catalog</h2>
            <div className="products-grid">
              {products?.map((product: Product) => (
                <div key={product.id} className="product-card">
                  <div className="product-info">
                    <h3>{product.name}</h3>
                    <p className="product-price">${product.price.toFixed(2)}</p>
                    <p className="product-inventory">
                      Available Inventory: <strong>{product.inventory}</strong>
                    </p>
                  </div>
                  <button
                    className="add-to-cart-btn"
                    onClick={() => handleAddToCart(product)}
                    disabled={product.inventory <= 0}
                  >
                    {product.inventory <= 0 ? "Out of Stock" : "Add to Cart"}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Shopping Cart Section */}
          <section className="cart-section">
            <h2>Your Shopping Cart</h2>
            {cartItemsList.length === 0 ? (
              <p className="empty-cart-text">Your cart is empty. Add some products!</p>
            ) : (
              <div className="cart-container">
                <div className="cart-items-list">
                  {cartItemsList.map((item) => (
                    <div key={item.product.id} className="cart-item">
                      <div className="cart-item-details">
                        <h4>{item.product.name}</h4>
                        <p>${item.product.price.toFixed(2)} each</p>
                      </div>
                      <div className="cart-item-actions">
                        <div className="quantity-controls">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          >
                            -
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                        <button
                          className="remove-item-btn"
                          onClick={() => handleRemoveFromCart(item.product.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Coupon Application */}
                <form onSubmit={handleApplyCoupon} className="coupon-form">
                  <input
                    type="text"
                    id="coupon-input"
                    placeholder="Enter Coupon Code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                  />
                  <button type="submit" id="apply-coupon-btn">
                    Apply Coupon
                  </button>
                </form>

                {couponMessage && (
                  <p className={`message ${couponMessage.isError ? "error" : "success"}`}>
                    {couponMessage.text}
                  </p>
                )}

                {/* Pricing Summary */}
                <div className="pricing-summary">
                  <div className="summary-row">
                    <span>Subtotal:</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="summary-row discount">
                      <span>Discount ({appliedCoupon?.code}):</span>
                      <span>-${discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="summary-row total">
                    <span>Grand Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Checkout Action */}
                <button
                  id="checkout-btn"
                  className="checkout-btn"
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Processing..." : "Place Order"}
                </button>

                {checkoutMessage && (
                  <div
                    className={`checkout-status-message ${
                      checkoutMessage.isError ? "error" : "success"
                    }`}
                  >
                    {checkoutMessage.text}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
