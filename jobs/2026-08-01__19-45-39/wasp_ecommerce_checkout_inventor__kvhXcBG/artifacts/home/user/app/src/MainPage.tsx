import { useMemo, useState } from "react";
import { useQuery, getProducts, applyCoupon, checkout } from "wasp/client/operations";
import { type Product } from "wasp/entities";
import "./Main.css";

type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

type AppliedCoupon = {
  code: string;
  type: string;
  value: number;
};

type Feedback = {
  kind: "success" | "error";
  text: string;
};

function computeDiscountLocally(coupon: AppliedCoupon, subtotal: number): number {
  if (coupon.type === "PERCENTAGE") {
    return round2((subtotal * coupon.value) / 100);
  }
  if (coupon.type === "FLAT") {
    return round2(Math.min(coupon.value, subtotal));
  }
  return 0;
}

function round2(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function MainPage() {
  const {
    data: products,
    isLoading: productsLoading,
    error: productsError,
  } = useQuery(getProducts);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponFeedback, setCouponFeedback] = useState<Feedback | null>(null);
  const [checkoutFeedback, setCheckoutFeedback] = useState<Feedback | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const subtotal = useMemo(
    () => round2(cart.reduce((sum, item) => sum + item.price * item.quantity, 0)),
    [cart],
  );

  const discount = useMemo(() => {
    if (!appliedCoupon) return 0;
    return computeDiscountLocally(appliedCoupon, subtotal);
  }, [appliedCoupon, subtotal]);

  const total = round2(Math.max(0, subtotal - discount));

  function addToCart(product: Product) {
    setCheckoutFeedback(null);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ];
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  async function handleApplyCoupon() {
    setCouponFeedback(null);
    if (cart.length === 0) {
      setCouponFeedback({ kind: "error", text: "Your cart is empty. Add items before applying a coupon." });
      return;
    }
    if (!couponInput.trim()) {
      setCouponFeedback({ kind: "error", text: "Please enter a coupon code." });
      return;
    }

    setIsApplyingCoupon(true);
    try {
      const result = await applyCoupon({
        code: couponInput,
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      });
      setAppliedCoupon({ code: result.code, type: result.type, value: result.value });
      setCouponFeedback({ kind: "success", text: result.message });
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponFeedback({
        kind: "error",
        text: err?.message ?? "Failed to apply coupon.",
      });
    } finally {
      setIsApplyingCoupon(false);
    }
  }

  async function handleCheckout() {
    setCheckoutFeedback(null);
    if (cart.length === 0) {
      setCheckoutFeedback({ kind: "error", text: "Your cart is empty. Add items before checking out." });
      return;
    }

    setIsCheckingOut(true);
    try {
      const result = await checkout({
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        couponCode: appliedCoupon?.code,
      });
      setCheckoutFeedback({
        kind: "success",
        text: `Order placed successfully! Order ID: ${result.orderId}`,
      });
      setCart([]);
      setAppliedCoupon(null);
      setCouponInput("");
      setCouponFeedback(null);
    } catch (err: any) {
      setCheckoutFeedback({
        kind: "error",
        text: err?.message ?? "Checkout failed. Please try again.",
      });
    } finally {
      setIsCheckingOut(false);
    }
  }

  return (
    <main className="shop-container">
      <h1 className="shop-title">Wasp Shop</h1>

      {productsError && (
        <p className="feedback feedback-error">Failed to load products.</p>
      )}

      <section className="catalog">
        <h2>Products</h2>
        {productsLoading && <p>Loading products...</p>}
        <div className="product-list">
          {products?.map((product) => (
            <div className="product-card" key={product.id} data-testid={`product-${product.id}`}>
              <div className="product-info">
                <span className="product-name">{product.name}</span>
                <span className="product-price">{formatMoney(product.price)}</span>
                <span className="product-inventory">
                  {product.inventory > 0
                    ? `In stock: ${product.inventory}`
                    : "Out of stock"}
                </span>
              </div>
              <button
                className="button button-filled"
                disabled={product.inventory <= 0}
                onClick={() => addToCart(product)}
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="cart">
        <h2>Cart</h2>
        {cart.length === 0 ? (
          <p>Your cart is empty.</p>
        ) : (
          <table className="cart-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Line Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.productId}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatMoney(item.price)}</td>
                  <td>{formatMoney(round2(item.price * item.quantity))}</td>
                  <td>
                    <button
                      className="button button-outlined button-small"
                      onClick={() => removeFromCart(item.productId)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="coupon-row">
          <input
            id="coupon-input"
            type="text"
            placeholder="Enter Coupon Code"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
          />
          <button
            id="apply-coupon-btn"
            className="button button-outlined"
            onClick={handleApplyCoupon}
            disabled={isApplyingCoupon}
          >
            Apply Coupon
          </button>
        </div>
        {couponFeedback && (
          <p className={`feedback feedback-${couponFeedback.kind}`}>
            {couponFeedback.text}
          </p>
        )}

        <div className="totals">
          <div className="totals-row">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="totals-row">
            <span>Discount</span>
            <span>-{formatMoney(discount)}</span>
          </div>
          <div className="totals-row totals-grand">
            <span>Grand Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>

        <button
          id="checkout-btn"
          className="button button-filled checkout-button"
          onClick={handleCheckout}
          disabled={isCheckingOut || cart.length === 0}
        >
          Place Order
        </button>
        {checkoutFeedback && (
          <p className={`feedback feedback-${checkoutFeedback.kind}`}>
            {checkoutFeedback.text}
          </p>
        )}
      </section>
    </main>
  );
}
