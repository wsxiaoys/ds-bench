// __CATALOG_SERVER_SECRET__
//
// This module is the SINGLE server-only data-access layer for the product
// catalog. It talks directly to a local SQLite database via `better-sqlite3`
// and MUST NEVER be imported from any code path that ends up in the client
// (browser) JavaScript bundle. It is only ever imported from Qwik City
// request handlers (`onGet` / `onPost`) which the Qwik optimizer strips out
// of the client build, guaranteeing this module (including the sentinel
// string above and all SQL statements) is tree-shaken away from `dist/`.

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";

export const CATALOG_SERVER_SENTINEL = "__CATALOG_SERVER_SECRET__";

export interface Product {
  id: number;
  name: string;
  priceCents: number;
  stock: number;
}

export interface NewProductInput {
  name: string;
  priceCents: number;
  stock: number;
}

const DB_PATH = join(process.cwd(), "data", "catalog.db");

const SEED_PRODUCTS: NewProductInput[] = [
  { name: "Trail Running Shoe", priceCents: 8999, stock: 42 },
  { name: "Insulated Water Bottle", priceCents: 2499, stock: 120 },
  { name: "Wireless Bike Computer", priceCents: 15999, stock: 17 },
];

let dbInstance: Database.Database | null = null;

/**
 * Lazily opens (and, on first run, initializes + seeds) the SQLite database.
 * The connection is memoized so the process reuses a single handle.
 *
 * Because `better-sqlite3` executes all statements synchronously, there is
 * no interleaving between two concurrently-handled HTTP requests on the
 * Node.js event loop: every read/write here runs to completion before the
 * next request's handler gets a turn, which is what keeps concurrent writes
 * from being lost or corrupted.
 */
function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  mkdirSync(dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      priceCents INTEGER NOT NULL,
      stock INTEGER NOT NULL
    );
  `);

  const { count } = db
    .prepare("SELECT COUNT(*) AS count FROM products")
    .get() as { count: number };

  if (count === 0) {
    const insert = db.prepare(
      "INSERT INTO products (name, priceCents, stock) VALUES (@name, @priceCents, @stock)",
    );
    const seedAll = db.transaction((items: NewProductInput[]) => {
      for (const item of items) {
        insert.run(item);
      }
    });
    seedAll(SEED_PRODUCTS);
  }

  dbInstance = db;
  return db;
}

/** Returns every product ordered by id ascending. */
export function listProducts(): Product[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT id, name, priceCents, stock FROM products ORDER BY id ASC",
    )
    .all() as Product[];
}

/** Persists a new product and returns the row as stored (server-assigned id). */
export function insertProduct(input: NewProductInput): Product {
  const db = getDb();
  const info = db
    .prepare(
      "INSERT INTO products (name, priceCents, stock) VALUES (@name, @priceCents, @stock)",
    )
    .run(input);
  return {
    id: Number(info.lastInsertRowid),
    name: input.name,
    priceCents: input.priceCents,
    stock: input.stock,
  };
}

/**
 * Deterministically serializes the catalog to JSON bytes: fixed key order,
 * no volatile fields, identical output whenever the underlying rows are
 * unchanged. Both the JSON endpoint and the HTML page's embedded
 * `<script type="application/json">` block MUST use this exact function so
 * their bytes stay in sync.
 */
export function serializeCatalog(products: Product[]): string {
  return JSON.stringify({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      priceCents: p.priceCents,
      stock: p.stock,
    })),
  });
}

/** Strong ETag derived from the exact response body bytes. */
export function computeEtag(body: string): string {
  const hash = createHash("sha256").update(body, "utf8").digest("hex");
  return `"${hash}"`;
}

/** Returns true if any ETag listed in an `If-None-Match` header matches. */
export function ifNoneMatchHits(
  ifNoneMatch: string | null,
  etag: string,
): boolean {
  if (!ifNoneMatch) {
    return false;
  }
  const trimmed = ifNoneMatch.trim();
  if (trimmed === "*") {
    return true;
  }
  return trimmed
    .split(",")
    .map((tag) => tag.trim())
    .some((tag) => tag === etag || tag === `W/${etag}`);
}

export function validateNewProduct(data: unknown): data is NewProductInput {
  if (!data || typeof data !== "object") {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  if (
    typeof candidate.name !== "string" ||
    candidate.name.trim().length === 0
  ) {
    return false;
  }
  if (
    typeof candidate.priceCents !== "number" ||
    !Number.isInteger(candidate.priceCents) ||
    candidate.priceCents < 0
  ) {
    return false;
  }
  if (
    typeof candidate.stock !== "number" ||
    !Number.isInteger(candidate.stock) ||
    candidate.stock < 0
  ) {
    return false;
  }
  return true;
}
