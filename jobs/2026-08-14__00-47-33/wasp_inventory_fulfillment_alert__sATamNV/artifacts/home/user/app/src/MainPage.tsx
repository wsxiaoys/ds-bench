import { useState } from "react";
import { useQuery, getProducts, getOrders, getAlerts, getPurchaseOrders, fulfillOrder } from "wasp/client/operations";
import { logout } from "wasp/client/auth";

export function MainPage() {
  const { data: products, isLoading: productsLoading, error: productsError } = useQuery(getProducts);
  const { data: orders, isLoading: ordersLoading, error: ordersError } = useQuery(getOrders);
  const { data: alerts, isLoading: alertsLoading, error: alertsError } = useQuery(getAlerts);
  const { data: purchaseOrders, isLoading: poLoading, error: poError } = useQuery(getPurchaseOrders);

  const [fulfillmentError, setFulfillmentError] = useState<string | null>(null);

  const handleFulfill = async (orderId: number) => {
    setFulfillmentError(null);
    try {
      await fulfillOrder({ orderId });
    } catch (err: any) {
      setFulfillmentError(err.message || "An error occurred during fulfillment.");
    }
  };

  if (productsLoading || ordersLoading || alertsLoading || poLoading) {
    return <div style={{ padding: "20px", fontFamily: "sans-serif" }}>Loading...</div>;
  }

  if (productsError || ordersError || alertsError || poError) {
    return (
      <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
        Error loading data. Please try again.
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ccc", paddingBottom: "10px", marginBottom: "20px" }}>
        <h1>Warehouse Inventory & Fulfillment Tracker</h1>
        <button 
          onClick={logout} 
          style={{ padding: "8px 16px", background: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Logout
        </button>
      </header>

      {/* Fulfillment Error message */}
      {fulfillmentError && (
        <div 
          data-testid="fulfillment-error" 
          style={{ background: "#ffebee", color: "#c62828", padding: "10px", borderRadius: "4px", marginBottom: "20px", border: "1px solid #ef9a9a" }}
        >
          {fulfillmentError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
        <div>
          {/* Products Section */}
          <section style={{ marginBottom: "40px" }}>
            <h2>Products Inventory</h2>
            <table 
              data-testid="products-table" 
              style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd" }}
            >
              <thead>
                <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                  <th style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>SKU</th>
                  <th style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>Name</th>
                  <th style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>Stock</th>
                  <th style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>Supplier</th>
                </tr>
              </thead>
              <tbody>
                {products?.map((product) => (
                  <tr key={product.id} style={{ borderBottom: "1px solid #ddd" }}>
                    <td style={{ padding: "10px" }}>{product.sku}</td>
                    <td style={{ padding: "10px" }}>{product.name}</td>
                    <td style={{ padding: "10px" }}>
                      <span data-testid={`product-stock-${product.sku}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td style={{ padding: "10px" }}>{product.supplier?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Orders Section */}
          <section>
            <h2>Customer Orders</h2>
            <div data-testid="orders-list" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {orders?.map((order) => (
                <div 
                  key={order.id} 
                  data-testid={`order-card-${order.id}`} 
                  style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "15px", background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <h3 style={{ margin: 0 }}>{order.customerName}</h3>
                    <span 
                      data-testid={`order-status-${order.id}`} 
                      style={{ 
                        padding: "4px 8px", 
                        borderRadius: "4px", 
                        fontSize: "0.85em", 
                        fontWeight: "bold",
                        background: order.status === "FULFILLED" ? "#e8f5e9" : "#fff3e0", 
                        color: order.status === "FULFILLED" ? "#2e7d32" : "#ef6c00" 
                      }}
                    >
                      {order.status}
                    </span>
                  </div>
                  
                  <div style={{ marginBottom: "10px" }}>
                    <h4 style={{ margin: "0 0 5px 0", fontSize: "0.95em", color: "#555" }}>Items:</h4>
                    <ul style={{ margin: 0, paddingLeft: "20px" }}>
                      {order.orderItems?.map((item: any) => (
                        <li key={item.id}>
                          {item.product?.name} (SKU: {item.product?.sku}) - Qty: {item.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {order.status === "PENDING" && (
                    <button 
                      data-testid={`fulfill-btn-${order.id}`} 
                      onClick={() => handleFulfill(order.id)}
                      style={{ padding: "8px 16px", background: "#4caf50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                    >
                      Fulfill Order
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div>
          {/* Alerts Section */}
          <section style={{ marginBottom: "40px" }}>
            <h2>Low Stock Alerts</h2>
            <div 
              data-testid="alerts-list" 
              style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#fffde7", padding: "15px", borderRadius: "8px", border: "1px solid #fff9c4" }}
            >
              {alerts && alerts.length > 0 ? (
                alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    data-testid="alert-item" 
                    style={{ padding: "8px", borderBottom: "1px solid #f0f0f0", color: "#f57f17", fontSize: "0.9em" }}
                  >
                    {alert.message}
                  </div>
                ))
              ) : (
                <div style={{ color: "#777", fontStyle: "italic" }}>No active alerts.</div>
              )}
            </div>
          </section>

          {/* Purchase Orders Section */}
          <section>
            <h2>Supplier Purchase Orders</h2>
            <div 
              data-testid="purchase-orders-list" 
              style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#f3e5f5", padding: "15px", borderRadius: "8px", border: "1px solid #e1bee7" }}
            >
              {purchaseOrders && purchaseOrders.length > 0 ? (
                purchaseOrders.map((po) => (
                  <div 
                    key={po.id} 
                    data-testid="purchase-order-item" 
                    style={{ padding: "8px", borderBottom: "1px solid #f0f0f0", color: "#4a148c", fontSize: "0.9em" }}
                  >
                    PO #{po.id}: Ordered {po.quantity} of {po.product?.sku} from {po.supplier?.name} (Status: {po.status})
                  </div>
                ))
              ) : (
                <div style={{ color: "#777", fontStyle: "italic" }}>No purchase orders sent.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
