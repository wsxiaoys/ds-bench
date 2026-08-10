import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, z, Form } from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";

export const useProducts = routeLoader$(async () => {
  const Database = (await import("better-sqlite3")).default;
  const db = new Database("/home/user/inventory-app/data/inventory.db");
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

export const useAdjustStock = routeAction$(
  async (data, { fail }) => {
    const Database = (await import("better-sqlite3")).default;
    const db = new Database("/home/user/inventory-app/data/inventory.db");
    try {
      const { productId, type, quantity } = data;

      const executeTx = db.transaction((prodId: number, movType: "receive" | "ship", qty: number) => {
        // Check if product exists
        const product = db.prepare("SELECT id FROM products WHERE id = ?").get(prodId);
        if (!product) {
          throw new Error("Product does not exist.");
        }

        // Get current stock on hand
        const result = db.prepare("SELECT COALESCE(SUM(delta), 0) as qty FROM stock_movements WHERE product_id = ?").get(prodId) as { qty: number } | undefined;
        const currentQty = result ? result.qty : 0;

        let delta = 0;
        let reason = "";

        if (movType === "receive") {
          delta = qty;
          reason = "receive";
        } else if (movType === "ship") {
          if (currentQty < qty) {
            throw new Error(`Insufficient stock on hand. Product has ${currentQty} units, tried to ship ${qty} units.`);
          }
          delta = -qty;
          reason = "ship";
        } else {
          throw new Error("Invalid movement type.");
        }

        // Insert exactly one ledger row
        db.prepare("INSERT INTO stock_movements (product_id, delta, reason) VALUES (?, ?, ?)")
          .run(prodId, delta, reason);
      });

      executeTx.immediate(productId, type, quantity);

      return { success: true };
    } catch (err: any) {
      return fail(400, { error: err.message || "An unexpected error occurred." });
    } finally {
      db.close();
    }
  },
  zod$({
    productId: z.coerce.number().int(),
    type: z.enum(["receive", "ship"]),
    quantity: z.coerce.number().int().positive(),
  })
);

export default component$(() => {
  const products = useProducts();
  const action = useAdjustStock();

  const hasError = action.value && (action.value.error || action.value.fieldErrors);

  return (
    <div style={{
      fontFamily: "system-ui, -apple-system, sans-serif",
      maxWidth: "800px",
      margin: "0 auto",
      padding: "20px",
      color: "#333",
      lineHeight: "1.5"
    }}>
      <header style={{
        borderBottom: "2px solid #eaeaea",
        paddingBottom: "10px",
        marginBottom: "30px"
      }}>
        <h1 style={{ margin: 0, fontSize: "2rem", color: "#111" }}>Warehouse Inventory Stock Manager</h1>
        <p style={{ margin: "5px 0 0", color: "#666" }}>Server-authoritative append-only stock ledger</p>
      </header>

      <section style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "15px" }}>Current Stock Levels</h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "20px"
        }}>
          {products.value.map((product) => (
            <div
              key={product.id}
              data-testid={`product-${product.id}`}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "15px",
                backgroundColor: "#f9f9f9",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
              }}
            >
              <div style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#0056b3" }}>
                {product.sku}
              </div>
              <div style={{ fontSize: "0.9rem", color: "#555", margin: "5px 0 15px" }}>
                {product.name}
              </div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                borderTop: "1px solid #eee",
                paddingTop: "10px"
              }}>
                <span style={{ fontSize: "0.85rem", color: "#666", textTransform: "uppercase" }}>On Hand:</span>
                <span
                  data-testid={`qty-${product.id}`}
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    color: product.quantity > 0 ? "#2e7d32" : "#c62828"
                  }}
                >
                  {product.quantity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "25px",
        backgroundColor: "#fff"
      }}>
        <h2 style={{ fontSize: "1.5rem", marginTop: 0, marginBottom: "20px" }}>Record Stock Movement</h2>
        
        <Form action={action} data-testid="movement-form">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
            <div style={{ flex: "1 1 200px" }}>
              <label for="productId" style={{ display: "block", fontWeight: "bold", marginBottom: "8px" }}>Product</label>
              <select
                name="productId"
                id="productId"
                required
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontSize: "1rem",
                  backgroundColor: "#fff"
                }}
              >
                <option value="">-- Select Product --</option>
                {products.value.map((product) => (
                  <option key={product.id} value={product.id}>
                    {`${product.sku} - ${product.name}`}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: "1 1 150px" }}>
              <label for="type" style={{ display: "block", fontWeight: "bold", marginBottom: "8px" }}>Movement Type</label>
              <select
                name="type"
                id="type"
                required
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontSize: "1rem",
                  backgroundColor: "#fff"
                }}
              >
                <option value="">-- Select Type --</option>
                <option value="receive">Receive (+)</option>
                <option value="ship">Ship (-)</option>
              </select>
            </div>

            <div style={{ flex: "1 1 120px" }}>
              <label for="quantity" style={{ display: "block", fontWeight: "bold", marginBottom: "8px" }}>Quantity</label>
              <input
                type="number"
                name="quantity"
                id="quantity"
                min="1"
                required
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontSize: "1rem",
                  boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              backgroundColor: "#0056b3",
              color: "#fff",
              padding: "12px 24px",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "background-color 0.2s"
            }}
          >
            Submit Movement
          </button>
        </Form>

        {hasError && (
          <div
            data-testid="error"
            style={{
              marginTop: "20px",
              padding: "15px",
              backgroundColor: "#fde8e8",
              border: "1px solid #f8b4b4",
              borderRadius: "4px",
              color: "#9b1c1c",
              fontWeight: "bold"
            }}
          >
            {action.value?.error || 
             (action.value?.fieldErrors && 
              Object.entries(action.value.fieldErrors).map(
                ([field, errs]) => `${field}: ${Array.isArray(errs) ? (errs as any).join(", ") : String(errs)}`
              ).join(". "))}
          </div>
        )}
      </section>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Warehouse Inventory Stock Manager",
  meta: [
    {
      name: "description",
      content: "Real-time stock management with immutable ledger",
    },
  ],
};
