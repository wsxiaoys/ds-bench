import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

// Server-only module. Must never be imported from client-executed code
// (only from routeLoader$ / routeAction$ closures).

const DB_PATH = "data/inventory.db";

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  dbInstance = db;
  return db;
}

export interface ProductWithQuantity {
  id: number;
  sku: string;
  name: string;
  quantity: number;
}

export function listProductsWithQuantity(): ProductWithQuantity[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         p.id AS id,
         p.sku AS sku,
         p.name AS name,
         COALESCE(SUM(m.delta), 0) AS quantity
       FROM products p
       LEFT JOIN stock_movements m ON m.product_id = p.id
       GROUP BY p.id, p.sku, p.name
       ORDER BY p.id ASC`,
    )
    .all() as ProductWithQuantity[];
  return rows;
}

export type MovementType = "receive" | "ship";

export type MovementResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Atomically applies a stock movement:
 *  - receive: inserts a ledger row with delta = +quantity
 *  - ship: inserts a ledger row with delta = -quantity, only if current
 *          on-hand quantity (sum of ledger deltas) is >= quantity
 *
 * The existence check, on-hand computation, and insert all happen inside
 * a single better-sqlite3 transaction so concurrent ship requests can
 * never oversell a product.
 */
export function applyMovement(
  productId: number,
  type: MovementType,
  quantity: number,
): MovementResult {
  const db = getDb();

  const run = db.transaction((): MovementResult => {
    const product = db
      .prepare("SELECT id FROM products WHERE id = ?")
      .get(productId) as { id: number } | undefined;

    if (!product) {
      return { ok: false, error: `Product ${productId} does not exist.` };
    }

    if (type === "receive") {
      db.prepare(
        "INSERT INTO stock_movements (product_id, delta, reason) VALUES (?, ?, ?)",
      ).run(productId, quantity, "receive");
      return { ok: true };
    }

    // type === "ship"
    const row = db
      .prepare(
        "SELECT COALESCE(SUM(delta), 0) AS onHand FROM stock_movements WHERE product_id = ?",
      )
      .get(productId) as { onHand: number };

    if (row.onHand < quantity) {
      return {
        ok: false,
        error: `Insufficient stock: only ${row.onHand} unit(s) available.`,
      };
    }

    db.prepare(
      "INSERT INTO stock_movements (product_id, delta, reason) VALUES (?, ?, ?)",
    ).run(productId, -quantity, "ship");
    return { ok: true };
  });

  // better-sqlite3 transactions are synchronous and use BEGIN IMMEDIATE-like
  // exclusivity via its default transaction mode, ensuring the read-then-write
  // here is atomic with respect to other connections/calls.
  return run.immediate();
}
