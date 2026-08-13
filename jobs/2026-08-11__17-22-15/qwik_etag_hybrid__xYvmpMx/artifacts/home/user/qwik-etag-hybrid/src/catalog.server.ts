import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// EXACT sentinel string required by the specification
export const SENTINEL = "__CATALOG_SERVER_SECRET__";

const dbPath = '/home/user/qwik-etag-hybrid/data/catalog.db';

// Ensure the directory exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Initialize database
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    priceCents INTEGER NOT NULL,
    stock INTEGER NOT NULL
  )
`);

// Idempotent seeding
const countRow = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
if (countRow.count === 0) {
  const insert = db.prepare('INSERT INTO products (name, priceCents, stock) VALUES (?, ?, ?)');
  const seed = db.transaction(() => {
    insert.run('Product A', 1000, 50);
    insert.run('Product B', 2000, 30);
    insert.run('Product C', 1500, 20);
  });
  seed();
}

export interface Product {
  id: number;
  name: string;
  priceCents: number;
  stock: number;
}

export function getProducts(): Product[] {
  // products MUST be ordered by id ascending
  return db.prepare('SELECT id, name, priceCents, stock FROM products ORDER BY id ASC').all() as Product[];
}

export function addProduct(product: Omit<Product, 'id'>): Product {
  const stmt = db.prepare('INSERT INTO products (name, priceCents, stock) VALUES (?, ?, ?)');
  const result = stmt.run(product.name, product.priceCents, product.stock);
  const id = Number(result.lastInsertRowid);
  return {
    id,
    name: product.name,
    priceCents: product.priceCents,
    stock: product.stock,
  };
}
