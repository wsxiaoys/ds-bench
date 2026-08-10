import Database from "better-sqlite3";
import path from "path";

// Sentinel string to ensure server-only code is not bundled into the client
export const CATALOG_SERVER_SECRET = "__CATALOG_SERVER_SECRET__";

export interface Product {
  id: number;
  name: string;
  priceCents: number;
  stock: number;
}

// Ensure the directory for the database exists
const dbDir = "/home/user/qwik-etag-hybrid/data";
const dbPath = path.join(dbDir, "catalog.db");

const db = new Database(dbPath);

// Initialize table and seed data
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    priceCents INTEGER NOT NULL,
    stock INTEGER NOT NULL
  )
`);

const countResult = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
if (countResult.count === 0) {
  const insert = db.prepare("INSERT INTO products (name, priceCents, stock) VALUES (?, ?, ?)");
  insert.run("Premium Wireless Headphones", 9900, 50);
  insert.run("Ergonomic Office Chair", 14900, 20);
  insert.run("Mechanical Gaming Keyboard", 7900, 35);
}

export function getAllProducts(): Product[] {
  // products MUST be ordered by id ascending
  return db.prepare("SELECT id, name, priceCents, stock FROM products ORDER BY id ASC").all() as Product[];
}

export function createProduct(name: string, priceCents: number, stock: number): Product {
  const info = db.prepare("INSERT INTO products (name, priceCents, stock) VALUES (?, ?, ?)").run(name, priceCents, stock);
  const id = Number(info.lastInsertRowid);
  return { id, name, priceCents, stock };
}
