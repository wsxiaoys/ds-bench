import { component$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  zod$,
  z,
} from "@builder.io/qwik-city";

export const useProductsLoader = routeLoader$(async () => {
  const Database = (await import("better-sqlite3")).default;
  const db = new Database("/home/user/inventory-app/data/inventory.db");
  try {
    const products = db
      .prepare(
        `
      SELECT p.id, p.sku, p.name, COALESCE(SUM(m.delta), 0) AS onHand
      FROM products p
      LEFT JOIN stock_movements m ON p.id = m.product_id
      GROUP BY p.id
    `,
      )
      .all() as { id: number; sku: string; name: string; onHand: number }[];
    return products;
  } finally {
    db.close();
  }
});

export const useAddMovementAction = routeAction$(
  async (data, { fail }) => {
    const { productId, type, quantity } = data;

    const Database = (await import("better-sqlite3")).default;
    const db = new Database("/home/user/inventory-app/data/inventory.db");

    try {
      // Execute the balance check and insertion inside an IMMEDIATE transaction
      const transaction = db.transaction(() => {
        // 1. Verify the product exists
        const product = db
          .prepare("SELECT id FROM products WHERE id = ?")
          .get(productId);
        if (!product) {
          throw new Error(`Product with ID ${productId} does not exist.`);
        }

        // 2. Compute current quantity
        const row = db
          .prepare(
            "SELECT COALESCE(SUM(delta), 0) as onHand FROM stock_movements WHERE product_id = ?",
          )
          .get(productId) as { onHand: number };
        const onHand = row.onHand;

        if (type === "ship") {
          if (onHand < quantity) {
            throw new Error(
              `Insufficient stock. Available: ${onHand}, requested: ${quantity}.`,
            );
          }
          const delta = -quantity;
          db.prepare(
            "INSERT INTO stock_movements (product_id, delta, reason) VALUES (?, ?, ?)",
          ).run(productId, delta, "ship");
        } else if (type === "receive") {
          const delta = quantity;
          db.prepare(
            "INSERT INTO stock_movements (product_id, delta, reason) VALUES (?, ?, ?)",
          ).run(productId, delta, "receive");
        } else {
          throw new Error(`Invalid movement type: ${type}`);
        }
      }).immediate;

      // Execute the immediate transaction
      transaction();

      return { success: true };
    } catch (err: any) {
      return fail(400, {
        message: err.message || "Failed to process stock movement.",
      });
    } finally {
      db.close();
    }
  },
  zod$({
    productId: z.coerce
      .number({
        required_error: "Product ID is required",
        invalid_type_error: "Product ID must be a number",
      })
      .int("Product ID must be an integer")
      .positive("Product ID must be a positive integer"),
    type: z.enum(["receive", "ship"], {
      required_error: "Movement type is required",
      invalid_type_error: "Type must be either receive or ship",
    }),
    quantity: z.coerce
      .number({
        required_error: "Quantity is required",
        invalid_type_error: "Quantity must be a number",
      })
      .int("Quantity must be an integer")
      .positive("Quantity must be a positive integer"),
  }),
);

export default component$(() => {
  const products = useProductsLoader();
  const action = useAddMovementAction();

  return (
    <div class="container">
      <header>
        <h1>Warehouse Stock Manager</h1>
        <p class="subtitle">
          Immutable ledger-based inventory stock levels and adjustments.
        </p>
      </header>

      <div class="grid">
        {/* Product Stock Levels Card */}
        <section class="card">
          <h2>Product Inventory</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>SKU</th>
                <th>Product Name</th>
                <th>On-Hand Stock</th>
              </tr>
            </thead>
            <tbody>
              {products.value.map((product) => (
                <tr key={product.id}>
                  <td>{product.id}</td>
                  <td data-testid={`product-${product.id}`}>{product.sku}</td>
                  <td>{product.name}</td>
                  <td class="qty-badge" data-testid={`qty-${product.id}`}>
                    {product.onHand}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Adjust Stock Form Card */}
        <section class="card">
          <h2>Adjust Stock</h2>

          {action.value?.failed && (
            <div class="error-box" data-testid="error">
              <strong>Error Processing Request:</strong>
              {action.value.message || (
                <ul style={{ margin: "5px 0 0 0", paddingLeft: "20px" }}>
                  {Object.entries(action.value.fieldErrors || {}).map(([field, errs]) => (
                    <li key={field}>
                      <strong>{field}:</strong> {Array.isArray(errs) ? errs.join(", ") : String(errs)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Form action={action} data-testid="movement-form">
            <div class="form-group">
              <label for="productId">Product ID</label>
              <input
                type="number"
                name="productId"
                id="productId"
                class="form-control"
                placeholder="e.g. 1"
                required
              />
            </div>

            <div class="form-group">
              <label for="type">Movement Type</label>
              <select name="type" id="type" class="form-control" required>
                <option value="receive">Receive (+)</option>
                <option value="ship">Ship (-)</option>
              </select>
            </div>

            <div class="form-group">
              <label for="quantity">Quantity</label>
              <input
                type="number"
                name="quantity"
                id="quantity"
                class="form-control"
                placeholder="e.g. 10"
                min="1"
                required
              />
            </div>

            <button type="submit" class="btn">
              Apply Movement
            </button>
          </Form>
        </section>
      </div>
    </div>
  );
});
