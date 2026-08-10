import React, { useState } from "react";
import { useQuery, getProducts, validateCoupon, checkout } from "wasp/client/operations";
import "./Main.css";

interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
}

export function MainPage() {
  const { data: products, isLoading, error: productsError } = useQuery(getProducts);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; type: string; value: number } | null>(null);
  
  const [couponSuccess, setCouponSuccess] = useState("");
  const [couponError, setCouponError] = useState("");

  const [checkoutSuccess, setCheckoutSuccess] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Add a product to the cart
  const addToCart = (product: { id: number; name: string; price: number; inventory: number }) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.productId === product.id);
      if (existingItem) {
        // Check if adding one more exceeds current catalog inventory
        if (existingItem.quantity >= product.inventory) {
          setCheckoutError(`Cannot add more "${product.name}". Only ${product.inventory} available.`);
          return prevCart;
        }
        setCheckoutError("");
        return prevCart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        if (product.inventory <= 0) {
          setCheckoutError(`"${product.name}" is out of stock.`);
          return prevCart;
        }
        setCheckoutError("");
        return [...prevCart, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
      }
    });
  };

  // Remove or decrement item from cart
  const removeFromCart = (productId: number) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.productId === productId);
      if (!existingItem) return prevCart;
      if (existingItem.quantity === 1) {
        return prevCart.filter((item) => item.productId !== productId);
      }
      return prevCart.map((item) =>
        item.productId === productId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      );
    });
  };

  // Completely remove item from cart
  const deleteFromCart = (productId: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  };

  // Apply Coupon Code
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) {
      setCouponError("Please enter a coupon code");
      setCouponSuccess("");
      return;
    }

    try {
      const coupon = await validateCoupon({ code: couponInput.trim() });
      setAppliedCoupon(coupon);
      setCouponSuccess(`Coupon "${coupon.code}" applied successfully!`);
      setCouponError("");
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponSuccess("");
      setCouponError(err.message || "Invalid coupon code");
    }
  };

  // Handle Checkout / Place Order
  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      setCheckoutError("Your cart is empty");
      setCheckoutSuccess("");
      return;
    }

    setIsCheckingOut(true);
    setCheckoutError("");
    setCheckoutSuccess("");

    try {
      const orderItems = cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      const order = await checkout({
        items: orderItems,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
      });

      setCheckoutSuccess(`Order placed successfully! Order ID: ${order.id}`);
      setCart([]); // Clear cart
      setAppliedCoupon(null); // Clear coupon
      setCouponInput("");
      setCouponSuccess("");
      setCouponError("");
    } catch (err: any) {
      // Ensure we display clear error messages for out-of-stock or insufficient inventory
      const errMsg = err.message || "An error occurred during checkout";
      setCheckoutError(errMsg);
      setCheckoutSuccess("");
    } finally {
      setIsCheckingOut(false);
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
  if (discount > subtotal) {
    discount = subtotal;
  }

  const grandTotal = Math.max(0, subtotal - discount);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Wasp E-commerce Checkout</h1>
        <p className="subtitle">Secure, fast, and transaction-safe shopping</p>
      </header>

      <div className="main-layout">
        {/* Product Catalog Section */}
        <section className="catalog-section">
          <h2>Product Catalog</h2>
          {isLoading && <div className="loading">Loading products...</div>}
          {productsError && <div className="error-message">Error loading products: {productsError.message}</div>}
          
          {products && products.length === 0 && (
            <div className="empty-message">No products available in the catalog.</div>
          )}

          {products && products.length > 0 && (
            <div className="product-list">
              {products.map((product: any) => (
                <div key={product.id} className="product-card">
                  <div className="product-info">
                    <h3>{product.name}</h3>
                    <p className="product-price">${product.price.toFixed(2)}</p>
                    <p className={`product-inventory ${product.inventory === 0 ? "out-of-stock" : ""}`}>
                      Available Inventory: {product.inventory}
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

        {/* Shopping Cart Section */}
        <section className="cart-section-container">
          <h2>Shopping Cart</h2>
          
          {cart.length === 0 ? (
            <div className="empty-cart-message">Your cart is empty. Add some products to get started!</div>
          ) : (
            <div className="cart-content">
              <div className="cart-items-list">
                {cart.map((item) => (
                  <div key={item.productId} className="cart-item-card">
                    <div className="cart-item-details">
                      <h4>{item.name}</h4>
                      <p className="cart-item-price">
                        ${item.price.toFixed(2)} x {item.quantity} = ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="cart-item-actions">
                      <button onClick={() => removeFromCart(item.productId)} className="cart-action-btn">-</button>
                      <span className="cart-item-qty">{item.quantity}</span>
                      <button 
                        onClick={() => {
                          const prod = products?.find((p: any) => p.id === item.productId);
                          if (prod) addToCart(prod);
                        }} 
                        className="cart-action-btn"
                      >
                        +
                      </button>
                      <button onClick={() => deleteFromCart(item.productId)} className="cart-delete-btn">Remove</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coupon Section */}
              <div className="coupon-container">
                <form onSubmit={handleApplyCoupon} className="coupon-form">
                  <input
                    type="text"
                    id="coupon-input"
                    placeholder="Enter Coupon Code"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    className="coupon-input-field"
                  />
                  <button type="submit" id="apply-coupon-btn" className="apply-coupon-button">
                    Apply Coupon
                  </button>
                </form>

                {couponSuccess && <div className="coupon-success-msg">{couponSuccess}</div>}
                {couponError && <div className="coupon-error-msg">{couponError}</div>}
              </div>

              {/* Summary Section */}
              <div className="cart-summary">
                <div className="summary-row">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {appliedCoupon && (
                  <div className="summary-row discount-row">
                    <span>Discount ({appliedCoupon.code}):</span>
                    <span>-${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="summary-row total-row">
                  <span>Grand Total:</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Place Order Section */}
              <div className="checkout-action-container">
                <button
                  onClick={handlePlaceOrder}
                  disabled={isCheckingOut}
                  id="checkout-btn"
                  className="place-order-button"
                >
                  {isCheckingOut ? "Processing..." : "Place Order"}
                </button>

                {checkoutSuccess && <div className="checkout-success-msg">{checkoutSuccess}</div>}
                {checkoutError && <div className="checkout-error-msg">{checkoutError}</div>}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
