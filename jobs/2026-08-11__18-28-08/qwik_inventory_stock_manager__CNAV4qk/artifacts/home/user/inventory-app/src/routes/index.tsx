import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, z, Form } from "@builder.io/qwik-city";

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

export const useAddMovement = routeAction$(
  async (data, { fail }) => {
    const Database = (await import("better-sqlite3")).default;
    const db = new Database("/home/user/inventory-app/data/inventory.db");

    try {
      const applyMovement = db.transaction((productId: number, type: "receive" | "ship", quantity: number) => {
        // 1. Check if product exists
        const product = db.prepare("SELECT id FROM products WHERE id = ?").get(productId);
        if (!product) {
          throw new Error("Product not found");
        }

        // 2. Validate quantity is a positive integer
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error("Quantity must be a positive integer");
        }

        // 3. Calculate current on-hand quantity
        const row = db.prepare("SELECT COALESCE(SUM(delta), 0) AS current_qty FROM stock_movements WHERE product_id = ?").get(productId) as { current_qty: number } | undefined;
        const currentQty = row ? row.current_qty : 0;

        // 4. Determine delta and check negative stock
        let delta = 0;
        if (type === "receive") {
          delta = quantity;
        } else if (type === "ship") {
          delta = -quantity;
          if (currentQty < quantity) {
            throw new Error(`Insufficient stock for ship operation (Available: ${currentQty}, Requested: ${quantity})`);
          }
        } else {
          throw new Error("Invalid movement type");
        }

        // 5. Insert into stock_movements
        db.prepare("INSERT INTO stock_movements (product_id, delta, reason) VALUES (?, ?, ?)")
          .run(productId, delta, type);

        return { success: true };
      });

      applyMovement.immediate(data.productId, data.type, data.quantity);
      return { success: true };
    } catch (err: any) {
      return fail(400, {
        message: err.message || "Failed to apply stock movement",
      });
    } finally {
      db.close();
    }
  },
  zod$({
    productId: z.coerce.number().int().positive("Product ID must be a positive integer"),
    type: z.enum(["receive", "ship"]),
    quantity: z.coerce.number().int().positive("Quantity must be a positive integer"),
  })
);

export default component$(() => {
  const products = useProducts();
  const action = useAddMovement();

  const getErrorMessage = (actionValue: any) => {
    if (!actionValue || !actionValue.failed) return null;
    if (actionValue.message) return actionValue.message;
    if (actionValue.fieldErrors) {
      return Object.entries(actionValue.fieldErrors)
        .map(([field, errs]) => {
          const msg = Array.isArray(errs) ? errs.join(", ") : String(errs);
          return `${field}: ${msg}`;
        })
        .join("; ");
    }
    return "An unknown error occurred";
  };

  const errorMsg = getErrorMessage(action.value);

  return (
    <div class="container">
      <header class="header">
        <h1>📦 Inventory Stock Manager</h1>
        <p class="subtitle">Real-time server-authoritative warehouse stock levels</p>
      </header>

      <main class="main-layout">
        <section class="products-section">
          <h2>Current Stock Levels</h2>
          <div class="products-grid">
            {products.value.map((product) => (
              <div
                key={product.id}
                data-testid={`product-${product.id}`}
                class="product-card"
              >
                <div class="product-info">
                  <span class="sku-badge">{product.sku}</span>
                  <h3 class="product-name">{product.name}</h3>
                </div>
                <div class="quantity-display">
                  <span class="qty-label">On Hand</span>
                  <span data-testid={`qty-${product.id}`} class="qty-val">
                    {product.quantity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section class="movement-section">
          <h2>Adjust Stock</h2>
          
          {errorMsg && (
            <div data-testid="error" class="error-banner">
              <strong>Error:</strong> {errorMsg}
            </div>
          )}

          {action.value && !action.value.failed && (
            <div class="success-banner">
              Stock movement applied successfully!
            </div>
          )}

          <Form action={action} data-testid="movement-form" class="movement-form">
            <div class="form-group">
              <label for="productId">Product</label>
              <select name="productId" id="productId" required>
                <option value="" disabled selected>Select a product...</option>
                {products.value.map((product) => (
                  <option key={product.id} value={product.id}>
                    {`${product.name} (${product.sku})`}
                  </option>
                ))}
              </select>
            </div>

            <div class="form-group">
              <label for="type">Movement Type</label>
              <select name="type" id="type" required>
                <option value="receive">Receive (Add Stock)</option>
                <option value="ship">Ship (Reduce Stock)</option>
              </select>
            </div>

            <div class="form-group">
              <label for="quantity">Quantity</label>
              <input
                type="number"
                name="quantity"
                id="quantity"
                min="1"
                step="1"
                placeholder="e.g. 10"
                required
              />
            </div>

            <button type="submit" class="submit-btn" disabled={action.isRunning}>
              {action.isRunning ? "Processing..." : "Submit Movement"}
            </button>
          </Form>
        </section>
      </main>
    </div>
  );
});
