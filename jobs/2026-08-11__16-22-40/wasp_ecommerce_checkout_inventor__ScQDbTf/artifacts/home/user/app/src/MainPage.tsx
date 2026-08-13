import React, { useState } from "react"
import { useQuery, getProducts, validateCoupon, checkout } from "wasp/client/operations"
import "./Main.css"

type CartItem = {
  productId: number
  name: string
  price: number
  quantity: number
}

type AppliedCoupon = {
  code: string
  type: string
  value: number
}

export function MainPage() {
  const { data: products, isLoading, error: productsError } = useQuery(getProducts)
  const [cart, setCart] = useState<CartItem[]>([])
  const [couponCode, setCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)
  
  const [couponMessage, setCouponMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [checkoutMessage, setCheckoutMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)

  const addToCart = (productId: number, name: string, price: number) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.productId === productId)
      if (existingItem) {
        return prevCart.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
        )
      } else {
        return [...prevCart, { productId, name, price, quantity: 1 }]
      }
    })
    // Clear checkout messages when cart changes
    setCheckoutMessage(null)
  }

  const removeFromCart = (productId: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId))
    setCheckoutMessage(null)
  }

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }
    setCart((prevCart) =>
      prevCart.map((item) => (item.productId === productId ? { ...item, quantity } : item))
    )
    setCheckoutMessage(null)
  }

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    setCouponMessage(null)
    if (!couponCode.trim()) {
      setCouponMessage({ text: "Please enter a coupon code", isError: true })
      return
    }

    try {
      const coupon = await validateCoupon({ code: couponCode })
      setAppliedCoupon(coupon)
      setCouponMessage({
        text: `Coupon applied successfully! ${
          coupon.type === "PERCENTAGE" ? `${coupon.value}% off` : `$${coupon.value} off`
        }`,
        isError: false,
      })
    } catch (err: any) {
      setAppliedCoupon(null)
      const errMsg = err.message || (err.data && err.data.message) || "Invalid coupon code"
      setCouponMessage({ text: errMsg, isError: true })
    }
  }

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setCheckoutMessage({ text: "Your cart is empty", isError: true })
      return
    }

    setIsCheckingOut(true)
    setCheckoutMessage(null)

    try {
      const res = await checkout({
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        couponCode: appliedCoupon?.code,
      })

      setCheckoutMessage({
        text: `Order placed successfully! Order ID: ${res.orderId}`,
        isError: false,
      })
      // Clear cart and coupon on success
      setCart([])
      setAppliedCoupon(null)
      setCouponCode("")
      setCouponMessage(null)
    } catch (err: any) {
      const errMsg = err.message || (err.data && err.data.message) || "Checkout failed"
      setCheckoutMessage({ text: errMsg, isError: true })
    } finally {
      setIsCheckingOut(false)
    }
  }

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  let discount = 0
  if (appliedCoupon) {
    if (appliedCoupon.type === "PERCENTAGE") {
      discount = subtotal * (appliedCoupon.value / 100)
    } else if (appliedCoupon.type === "FLAT") {
      discount = appliedCoupon.value
    }
  }
  const grandTotal = Math.max(0, subtotal - discount)

  return (
    <main className="container">
      <header className="header">
        <h1 className="main-title">Wasp E-Commerce Checkout</h1>
        <p className="subtitle">With Inventory Tracking &amp; Concurrency Protection</p>
      </header>

      <div className="grid-layout">
        {/* Product Catalog */}
        <section className="card products-section">
          <h2>Product Catalog</h2>
          {isLoading && <p>Loading products...</p>}
          {productsError && <p className="error-text">Error loading products: {productsError.message}</p>}
          {products && products.length === 0 && <p>No products available.</p>}
          
          {products && (
            <div className="product-list">
              {products.map((product) => (
                <div key={product.id} className="product-item">
                  <div className="product-info">
                    <span className="product-name">{product.name}</span>
                    <span className="product-price">${product.price.toFixed(2)}</span>
                    <span className="product-inventory">
                      Available: {product.inventory > 0 ? (
                        <strong className="stock-in">{product.inventory}</strong>
                      ) : (
                        <strong className="stock-out">Out of stock</strong>
                      )}
                    </span>
                  </div>
                  <button
                    className="button button-filled add-to-cart-btn"
                    onClick={() => addToCart(product.id, product.name, product.price)}
                    disabled={product.inventory <= 0}
                  >
                    Add to Cart
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Shopping Cart */}
        <section className="card cart-section">
          <h2>Shopping Cart</h2>
          {cart.length === 0 ? (
            <p className="empty-cart-text">Your cart is empty.</p>
          ) : (
            <div className="cart-content">
              <div className="cart-items">
                {cart.map((item) => (
                  <div key={item.productId} className="cart-item">
                    <div className="cart-item-info">
                      <span className="cart-item-name">{item.name}</span>
                      <span className="cart-item-price">${item.price.toFixed(2)} each</span>
                    </div>
                    <div className="cart-item-actions">
                      <button 
                        className="qty-btn"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      >
                        -
                      </button>
                      <span className="cart-item-qty">{item.quantity}</span>
                      <button 
                        className="qty-btn"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      >
                        +
                      </button>
                      <button 
                        className="remove-btn"
                        onClick={() => removeFromCart(item.productId)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coupon Section */}
              <div className="coupon-container">
                <form onSubmit={handleApplyCoupon} className="coupon-form">
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
                    type="submit"
                    className="button button-outlined"
                  >
                    Apply Coupon
                  </button>
                </form>
                {couponMessage && (
                  <p className={couponMessage.isError ? "error-text" : "success-text"}>
                    {couponMessage.text}
                  </p>
                )}
              </div>

              {/* Totals Summary */}
              <div className="totals-summary">
                <div className="total-line">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {appliedCoupon && (
                  <div className="total-line discount-line">
                    <span>Discount ({appliedCoupon.code}):</span>
                    <span>-${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="total-line grand-total-line">
                  <span>Grand Total:</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout Action */}
              <div className="checkout-container">
                <button
                  id="checkout-btn"
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="button button-filled checkout-action-btn"
                >
                  {isCheckingOut ? "Placing Order..." : "Place Order"}
                </button>
                {checkoutMessage && (
                  <div className={`checkout-message ${checkoutMessage.isError ? "error-box" : "success-box"}`}>
                    {checkoutMessage.text}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
