import React, { useState } from "react";
import { useQuery, getProducts, getOrders, getAlerts, getPurchaseOrders, fulfillOrder } from "wasp/client/operations";
import { logout } from "wasp/client/auth";

export function MainPage({ user }: { user: any }) {
  const { data: products, isLoading: productsLoading } = useQuery(getProducts);
  const { data: orders, isLoading: ordersLoading } = useQuery(getOrders);
  const { data: alerts, isLoading: alertsLoading } = useQuery(getAlerts);
  const { data: purchaseOrders, isLoading: poLoading } = useQuery(getPurchaseOrders);

  const [fulfillmentError, setFulfillmentError] = useState<string | null>(null);
  const [isFulfilling, setIsFulfilling] = useState<number | null>(null);

  const handleFulfill = async (orderId: number) => {
    setIsFulfilling(orderId);
    setFulfillmentError(null);
    try {
      await fulfillOrder({ orderId });
    } catch (err: any) {
      const errorMsg = err.message || (err.data && err.data.message) || "An error occurred during order fulfillment.";
      setFulfillmentError(errorMsg);
    } finally {
      setIsFulfilling(null);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f3f4f6",
      fontFamily: "system-ui, sans-serif",
      color: "#1f2937",
      padding: "2rem"
    }}>
      {/* Header */}
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#ffffff",
        padding: "1rem 2rem",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        marginBottom: "2rem"
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "bold", color: "#111827" }}>
            Warehouse Inventory & Fulfillment Tracker
          </h1>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "#6b7280" }}>
            Logged in as: <strong>{user?.username}</strong>
          </p>
        </div>
        <button
          onClick={logout}
          style={{
            backgroundColor: "#ef4444",
            color: "#ffffff",
            border: "none",
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
            transition: "background-color 0.2s"
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#dc2626")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#ef4444")}
        >
          Logout
        </button>
      </header>

      {/* Fulfillment Error Message */}
      {fulfillmentError && (
        <div
          data-testid="fulfillment-error"
          style={{
            backgroundColor: "#fee2e2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "2rem",
            fontWeight: "500"
          }}
        >
          {fulfillmentError}
        </div>
      )}

      {/* Main Grid Layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "2rem",
        alignItems: "start"
      }}>
        
        {/* Left Column: Products & Orders */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Products Section */}
          <section style={{
            backgroundColor: "#ffffff",
            padding: "1.5rem",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
          }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.5rem" }}>
              Products Inventory
            </h2>
            {productsLoading ? (
              <p>Loading products...</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  data-testid="products-table"
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "left"
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                      <th style={{ padding: "0.75rem" }}>SKU</th>
                      <th style={{ padding: "0.75rem" }}>Name</th>
                      <th style={{ padding: "0.75rem" }}>Stock</th>
                      <th style={{ padding: "0.75rem" }}>Supplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products?.map((product: any) => (
                      <tr key={product.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "0.75rem", fontWeight: "600" }}>{product.sku}</td>
                        <td style={{ padding: "0.75rem" }}>{product.name}</td>
                        <td style={{ padding: "0.75rem" }}>
                          <span
                            data-testid={`product-stock-${product.sku}`}
                            style={{
                              backgroundColor: product.stock < product.lowStockThreshold ? "#fee2e2" : "#d1fae5",
                              color: product.stock < product.lowStockThreshold ? "#991b1b" : "#065f46",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "4px",
                              fontWeight: "bold"
                            }}
                          >
                            {product.stock}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem", color: "#4b5563" }}>{product.supplier?.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Customer Orders Section */}
          <section style={{
            backgroundColor: "#ffffff",
            padding: "1.5rem",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
          }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.5rem" }}>
              Customer Orders
            </h2>
            {ordersLoading ? (
              <p>Loading orders...</p>
            ) : (
              <div data-testid="orders-list" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {orders?.map((order: any) => (
                  <div
                    key={order.id}
                    data-testid={`order-card-${order.id}`}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      padding: "1rem",
                      backgroundColor: "#f9fafb"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{order.customerName}</span>
                      <span
                        data-testid={`order-status-${order.id}`}
                        style={{
                          textTransform: "uppercase",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "9999px",
                          backgroundColor: order.status === "FULFILLED" ? "#d1fae5" : "#fef3c7",
                          color: order.status === "FULFILLED" ? "#065f46" : "#92400e"
                        }}
                      >
                        {order.status}
                      </span>
                    </div>
                    
                    {/* Items */}
                    <div style={{ fontSize: "0.875rem", color: "#4b5563", marginBottom: "1rem" }}>
                      <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
                        {order.orderItems?.map((item: any) => (
                          <li key={item.id}>
                            {item.product?.name} ({item.product?.sku}) &times; <strong>{item.quantity}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Fulfill Button */}
                    {order.status === "PENDING" && (
                      <button
                        data-testid={`fulfill-btn-${order.id}`}
                        disabled={isFulfilling !== null}
                        onClick={() => handleFulfill(order.id)}
                        style={{
                          backgroundColor: "#3b82f6",
                          color: "#ffffff",
                          border: "none",
                          padding: "0.5rem 1rem",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontWeight: "600",
                          width: "100%",
                          transition: "background-color 0.2s"
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#3b82f6")}
                      >
                        {isFulfilling === order.id ? "Processing..." : "Fulfill Order"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        {/* Right Column: Alerts & Purchase Orders */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Low Stock Alerts Section */}
          <section style={{
            backgroundColor: "#ffffff",
            padding: "1.5rem",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
          }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.5rem" }}>
              Low Stock Alerts
            </h2>
            {alertsLoading ? (
              <p>Loading alerts...</p>
            ) : (
              <div data-testid="alerts-list" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {alerts && alerts.length > 0 ? (
                  alerts.map((alert: any) => (
                    <div
                      key={alert.id}
                      data-testid="alert-item"
                      style={{
                        backgroundColor: "#fee2e2",
                        borderLeft: "4px solid #ef4444",
                        padding: "0.75rem 1rem",
                        borderRadius: "0 4px 4px 0",
                        fontSize: "0.875rem",
                        color: "#991b1b"
                      }}
                    >
                      {alert.message}
                    </div>
                  ))
                ) : (
                  <p style={{ color: "#6b7280", margin: 0 }}>No alerts at this time.</p>
                )}
              </div>
            )}
          </section>

          {/* Supplier Purchase Orders Section */}
          <section style={{
            backgroundColor: "#ffffff",
            padding: "1.5rem",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
          }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.5rem" }}>
              Supplier Purchase Orders
            </h2>
            {poLoading ? (
              <p>Loading purchase orders...</p>
            ) : (
              <div data-testid="purchase-orders-list" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {purchaseOrders && purchaseOrders.length > 0 ? (
                  purchaseOrders.map((po: any) => (
                    <div
                      key={po.id}
                      data-testid="purchase-order-item"
                      style={{
                        backgroundColor: "#eff6ff",
                        borderLeft: "4px solid #3b82f6",
                        padding: "0.75rem 1rem",
                        borderRadius: "0 4px 4px 0",
                        fontSize: "0.875rem",
                        color: "#1e3a8a"
                      }}
                    >
                      <div>
                        Supplier: <strong>{po.supplier?.name}</strong>
                      </div>
                      <div style={{ marginTop: "0.25rem" }}>
                        Product SKU: <strong>{po.product?.sku}</strong> | Quantity Ordered: <strong>{po.quantity}</strong>
                      </div>
                      <div style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#2563eb", fontWeight: "bold" }}>
                        Status: {po.status}
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: "#6b7280", margin: 0 }}>No purchase orders generated yet.</p>
                )}
              </div>
            )}
          </section>

        </div>

      </div>
    </div>
  );
}
