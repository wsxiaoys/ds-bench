import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Sentinel string required by the requirements
export const CATALOG_SERVER_SECRET = "__CATALOG_SERVER_SECRET__";

const dbDir = "/home/user/qwik-etag-hybrid/data";
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "catalog.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Initialize table
db.prepare(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    priceCents INTEGER NOT NULL,
    stock INTEGER NOT NULL
  )
`).run();

// Idempotent seeding
const countRow = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
if (countRow.count === 0) {
  const insert = db.prepare("INSERT INTO products (name, priceCents, stock) VALUES (?, ?, ?)");
  const seedTransaction = db.transaction(() => {
    insert.run("Premium Wireless Headphones", 9999, 50);
    insert.run("Ergonomic Mechanical Keyboard", 14999, 30);
    insert.run("Ultra-wide Curved Monitor", 34999, 15);
  });
  seedTransaction();
}

export interface Product {
  id: number;
  name: string;
  priceCents: number;
  stock: number;
}

export function getProducts(): Product[] {
  return db.prepare("SELECT id, name, priceCents, stock FROM products ORDER BY id ASC").all() as Product[];
}

export function addProduct(name: string, priceCents: number, stock: number): Product {
  const info = db.prepare("INSERT INTO products (name, priceCents, stock) VALUES (?, ?, ?)").run(name, priceCents, stock);
  return {
    id: Number(info.lastInsertRowid),
    name,
    priceCents,
    stock,
  };
}
