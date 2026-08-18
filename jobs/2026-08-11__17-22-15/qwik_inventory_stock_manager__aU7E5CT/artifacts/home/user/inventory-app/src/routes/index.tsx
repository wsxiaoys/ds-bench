import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, Form } from "@builder.io/qwik-city";
import { z } from "zod";

// Helper to get database connection
const getDb = async () => {
  const Database = (await import("better-sqlite3")).default;
  return new Database("/home/user/inventory-app/data/inventory.db");
};

// Route loader to get all products and their current quantities (sum of deltas)
export const useProductsLoader = routeLoader$(async () => {
  const db = await getDb();
  try {
    const products = db.prepare(`
      SELECT 
        p.id, 
        p.sku, 
        p.name, 
        COALESCE(SUM(sm.delta), 0) AS quantity
      FROM products p
      LEFT JOIN stock_movements sm ON p.id = sm.product_id
      GROUP BY p.id
    `).all() as { id: number; sku: string; name: string; quantity: number }[];
    return products;
  } finally {
    db.close();
  }
});

// Route action to handle stock adjustments (receive/ship)
export const useMovementAction = routeAction$(
  async (data, { fail }) => {
    const { productId, type, quantity } = data;

    // Validate inputs
    if (!/^\d+$/.test(productId)) {
      return fail(400, { message: "Product ID must be an integer" });
    }
    if (!/^\d+$/.test(quantity)) {
      return fail(400, { message: "Quantity must be a positive integer" });
    }

    const prodId = parseInt(productId, 10);
    const qty = parseInt(quantity, 10);

    if (qty <= 0) {
      return fail(400, { message: "Quantity must be a positive integer" });
    }

    if (type !== "receive" && type !== "ship") {
      return fail(400, { message: "Type must be either receive or ship" });
    }

    const db = await getDb();
    try {
      const tx = db.transaction(() => {
        // Check if product exists
        const product = db.prepare("SELECT id FROM products WHERE id = ?").get(prodId);
        if (!product) {
          throw new Error("Product does not exist");
        }

        // Compute current quantity
        const row = db.prepare(`
          SELECT COALESCE(SUM(delta), 0) AS quantity
          FROM stock_movements
          WHERE product_id = ?
        `).get(prodId) as { quantity: number } | undefined;

        const currentQty = row ? row.quantity : 0;
        const delta = type === "receive" ? qty : -qty;

        if (type === "ship" && currentQty < qty) {
          throw new Error("Insufficient stock");
        }

        // Insert movement
        db.prepare(`
          INSERT INTO stock_movements (product_id, delta, reason)
          VALUES (?, ?, ?)
        `).run(prodId, delta, type);
      });

      // Execute transaction with immediate lock
      tx.immediate();
      return { success: true };
    } catch (err: any) {
      return fail(400, { message: err.message || "An error occurred" });
    } finally {
      db.close();
    }
  },
  zod$({
    productId: z.string(),
    type: z.string(),
    quantity: z.string(),
  })
);

export default component$(() => {
  const products = useProductsLoader();
  const action = useMovementAction();

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}>
      <h2 style={{ borderBottom: "2px solid #333", paddingBottom: "10px" }}>Inventory Stock Manager</h2>

      {/* Error display */}
      {action.value?.failed && (
        <div 
          data-testid="error" 
          style={{ 
            color: "red", 
            backgroundColor: "#ffe6e6", 
            padding: "12px", 
            borderRadius: "4px", 
            marginBottom: "20px",
            border: "1px solid red",
            fontWeight: "bold"
          }}
        >
          {action.value.message || "An error occurred"}
        </div>
      )}

      {/* Product List */}
      <div style={{ marginBottom: "30px" }}>
        <h3>Products</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {products.value.map((product) => (
            <div 
              key={product.id} 
              style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                padding: "12px", 
                border: "1px solid #ccc", 
                borderRadius: "6px",
                backgroundColor: "#f9f9f9"
              }}
            >
              <div>
                <strong data-testid={`product-${product.id}`} style={{ fontSize: "1.1em" }}>
                  {product.sku}
                </strong>
                <span style={{ marginLeft: "10px", color: "#666" }}>({product.name})</span>
              </div>
              <div>
                <span style={{ fontWeight: "bold", marginRight: "5px" }}>On Hand:</span>
                <span 
                  data-testid={`qty-${product.id}`} 
                  style={{ 
                    backgroundColor: "#e0e0e0", 
                    padding: "4px 8px", 
                    borderRadius: "4px", 
                    fontWeight: "bold" 
                  }}
                >
                  {product.quantity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Movement Form */}
      <div style={{ padding: "20px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#fff" }}>
        <h3>Adjust Stock</h3>
        <Form 
          action={action} 
          data-testid="movement-form"
          style={{ display: "flex", flexDirection: "column", gap: "15px" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label for="productId" style={{ fontWeight: "bold" }}>Product</label>
            <select 
              id="productId" 
              name="productId" 
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "1em" }}
              required
            >
              <option value="">-- Select Product --</option>
              {products.value.map((product) => (
                <option key={product.id} value={product.id}>
                  {`${product.sku} - ${product.name}`}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label for="type" style={{ fontWeight: "bold" }}>Movement Type</label>
            <select 
              id="type" 
              name="type" 
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "1em" }}
              required
            >
              <option value="receive">Receive</option>
              <option value="ship">Ship</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label for="quantity" style={{ fontWeight: "bold" }}>Quantity</label>
            <input 
              type="number" 
              id="quantity" 
              name="quantity" 
              min="1"
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "1em" }}
              required
            />
          </div>

          <button 
            type="submit" 
            style={{ 
              padding: "12px", 
              backgroundColor: "#0070f3", 
              color: "white", 
              border: "none", 
              borderRadius: "4px", 
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "1em"
            }}
          >
            Submit Movement
          </button>
        </Form>
      </div>
    </div>
  );
});
