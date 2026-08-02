import { useState, useCallback } from "react";
import { useQuery, getProducts } from "wasp/client/operations";
import { addToCart, applyCoupon, checkout } from "wasp/client/operations";
import "./Main.css";

type CartItem = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
};

export function MainPage() {
  const { data: products, isLoading, error } = useQuery(getProducts);

  const [cart, setCart] = useState<CartState>({
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    couponCode: null,
  });

  const [couponInput, setCouponInput] = useState("");
  const [couponMessage, setCouponMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [addingToCart, setAddingToCart] = useState<number | null>(null);

  const handleAddToCart = useCallback(async (productId: number) => {
    setAddingToCart(productId);
    try {
      await addToCart({ productId, quantity: 1 });
      // Refresh cart state by re-fetching product info
      setCart((prev) => prev); // trigger re-render
      setCouponMessage(null);
      setCheckoutMessage(null);
    } catch (err: any) {
      console.error("Failed to add to cart:", err);
    } finally {
      setAddingToCart(null);
    }
  }, []);

  const handleApplyCoupon = useCallback(async () => {
    if (!couponInput.trim()) return;
    setCouponMessage(null);
    try {
      const result = await applyCoupon({ code: couponInput.trim() });
      setCart({
        items: result.cartItems,
        subtotal: result.subtotal,
        discount: result.discount,
        total: result.total,
        couponCode: couponInput.trim(),
      });
      setCouponMessage({
        type: "success",
        text: `Coupon applied! You save $${result.discount.toFixed(2)}.`,
      });
    } catch (err: any) {
      setCouponMessage({
        type: "error",
        text: err?.message || "Failed to apply coupon",
      });
      // Reset cart state
      setCart((prev) => ({
        ...prev,
        discount: 0,
        total: prev.subtotal,
        couponCode: null,
      }));
    }
  }, [couponInput]);

  const handleCheckout = useCallback(async () => {
    setCheckoutMessage(null);
    try {
      const result = await checkout({
        couponCode: cart.couponCode || undefined,
      });
      setCheckoutMessage({
        type: "success",
        text: `Order placed successfully! Order ID: ${result.orderId}`,
      });
      // Clear cart
      setCart({
        items: [],
        subtotal: 0,
        discount: 0,
        total: 0,
        couponCode: null,
      });
      setCouponInput("");
      setCouponMessage(null);
    } catch (err: any) {
      setCheckoutMessage({
        type: "error",
        text: err?.message || "Checkout failed",
      });
    }
  }, [cart]);

  if (isLoading) {
    return (
      <main className="container">
        <h2 className="title">Loading products...</h2>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container">
        <h2 className="title">Error loading products</h2>
        <p className="content">{error.message}</p>
      </main>
    );
  }

  return (
    <main className="container">
      <h1 className="title">E-Commerce Store</h1>

      {/* Product Catalog */}
      <section className="section">
        <h2 className="section-title">Products</h2>
        <div className="product-grid">
          {products?.map((product) => (
            <div key={product.id} className="product-card">
              <h3 className="product-name">{product.name}</h3>
              <p className="product-price">${product.price.toFixed(2)}</p>
              <p className={`product-inventory ${product.inventory <= 2 ? "low-stock" : ""}`}>
                {product.inventory > 0
                  ? `In Stock: ${product.inventory}`
                  : "Out of Stock"}
              </p>
              <button
                className="button button-filled add-to-cart-btn"
                onClick={() => handleAddToCart(product.id)}
                disabled={product.inventory === 0 || addingToCart === product.id}
              >
                {addingToCart === product.id ? "Adding..." : "Add to Cart"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Shopping Cart */}
      <section className="section cart-section">
        <h2 className="section-title">Shopping Cart</h2>

        {cart.items.length === 0 ? (
          <p className="cart-empty">Your cart is empty.</p>
        ) : (
          <div className="cart-items">
            {cart.items.map((item) => (
              <div key={item.productId} className="cart-item">
                <span className="cart-item-name">{item.name}</span>
                <span className="cart-item-qty">x{item.quantity}</span>
                <span className="cart-item-price">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="cart-summary">
              <div className="cart-row">
                <span>Subtotal:</span>
                <span>${cart.subtotal.toFixed(2)}</span>
              </div>
              {cart.discount > 0 && (
                <div className="cart-row cart-discount">
                  <span>Discount:</span>
                  <span>-${cart.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="cart-row cart-total">
                <span>Total:</span>
                <span>${cart.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Coupon Section */}
        <div className="coupon-section">
          <div className="coupon-input-group">
            <input
              id="coupon-input"
              type="text"
              className="coupon-input"
              placeholder="Enter Coupon Code"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
            />
            <button
              id="apply-coupon-btn"
              className="button button-outlined"
              onClick={handleApplyCoupon}
            >
              Apply Coupon
            </button>
          </div>
          {couponMessage && (
            <p
              className={`message ${
                couponMessage.type === "success" ? "message-success" : "message-error"
              }`}
            >
              {couponMessage.text}
            </p>
          )}
        </div>

        {/* Checkout */}
        <div className="checkout-section">
          <button
            id="checkout-btn"
            className="button button-filled checkout-btn"
            onClick={handleCheckout}
            disabled={cart.items.length === 0}
          >
            Place Order
          </button>
          {checkoutMessage && (
            <p
              className={`message ${
                checkoutMessage.type === "success" ? "message-success" : "message-error"
              }`}
            >
              {checkoutMessage.text}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
