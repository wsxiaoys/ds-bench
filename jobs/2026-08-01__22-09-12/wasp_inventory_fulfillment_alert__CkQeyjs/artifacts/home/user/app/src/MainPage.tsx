import { useQuery, useAction, getProducts, getOrders, getAlerts, getPurchaseOrders } from "wasp/client/operations";
import { fulfillOrder } from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import { useState } from "react";
import "./Main.css";

export function MainPage() {
  const { data: products } = useQuery(getProducts);
  const { data: orders } = useQuery(getOrders);
  const { data: alerts } = useQuery(getAlerts);
  const { data: purchaseOrders } = useQuery(getPurchaseOrders);

  const fulfillOrderFn = useAction(fulfillOrder);
  const [error, setError] = useState<string | null>(null);

  const handleFulfillOrder = async (orderId: number) => {
    setError(null);
    try {
      await fulfillOrderFn({ orderId });
    } catch (err: any) {
      setError(err.message || "Error fulfilling order");
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Warehouse Inventory &amp; Fulfillment Tracker</h1>
        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </header>

      {error && (
        <div className="error-banner" data-testid="fulfillment-error">
          {error}
        </div>
      )}

      <section className="section">
        <h2>Products</h2>
        <table className="data-table" data-testid="products-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Stock</th>
              <th>Supplier</th>
            </tr>
          </thead>
          <tbody>
            {products?.map((p: any) => (
              <tr key={p.id}>
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td data-testid={`product-stock-${p.sku}`}>{p.stock}</td>
                <td>{p.supplier?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section">
        <h2>Customer Orders</h2>
        <div className="orders-list" data-testid="orders-list">
          {orders?.map((o: any) => (
            <div
              key={o.id}
              className="order-card"
              data-testid={`order-card-${o.id}`}
            >
              <div className="order-header">
                <strong>{o.customerName}</strong>
                <span
                  className={`status-badge ${o.status.toLowerCase()}`}
                  data-testid={`order-status-${o.id}`}
                >
                  {o.status}
                </span>
              </div>
              <ul className="order-items">
                {o.orderItems?.map((item: any) => (
                  <li key={item.id}>
                    {item.product?.name} (SKU: {item.product?.sku}) x{" "}
                    {item.quantity}
                  </li>
                ))}
              </ul>
              {o.status === "PENDING" && (
                <button
                  className="fulfill-btn"
                  data-testid={`fulfill-btn-${o.id}`}
                  onClick={() => handleFulfillOrder(o.id)}
                >
                  Fulfill Order
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Low Stock Alerts</h2>
        <div className="alerts-list" data-testid="alerts-list">
          {alerts?.length === 0 && <p>No alerts</p>}
          {alerts?.map((a: any) => (
            <div
              key={a.id}
              className="alert-item"
              data-testid="alert-item"
            >
              {a.message}
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Supplier Purchase Orders</h2>
        <div
          className="purchase-orders-list"
          data-testid="purchase-orders-list"
        >
          {purchaseOrders?.length === 0 && <p>No purchase orders</p>}
          {purchaseOrders?.map((po: any) => (
            <div
              key={po.id}
              className="purchase-order-item"
              data-testid="purchase-order-item"
            >
              <strong>{po.supplier?.name}</strong> — SKU: {po.product?.sku} — Qty:{" "}
              {po.quantity} — Status: {po.status}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
