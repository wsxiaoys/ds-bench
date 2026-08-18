import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

// Sentinel string required by the prompt
export const SENTINEL = "__CATALOG_SERVER_SECRET__";

export interface Product {
  id: number;
  name: string;
  priceCents: number;
  stock: number;
}

const DB_DIR = "/home/user/qwik-etag-hybrid/data";
const DB_PATH = join(DB_DIR, "catalog.db");

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  // Assign to globalThis to prevent tree-shaking of the sentinel in the server bundle
  (globalThis as any).__catalog_sentinel = SENTINEL;

  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  
  // Enable WAL mode for better concurrency and performance
  db.pragma("journal_mode = WAL");
  
  // Create products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      priceCents INTEGER NOT NULL,
      stock INTEGER NOT NULL
    )
  `);

  // Check if table is empty to seed
  const countRow = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
  if (countRow.count === 0) {
    const insert = db.prepare("INSERT INTO products (name, priceCents, stock) VALUES (?, ?, ?)");
    // Seed with 3 products
    const seedTransaction = db.transaction(() => {
      insert.run("Premium Wireless Headphones", 9999, 50);
      insert.run("Ergonomic Office Chair", 14950, 15);
      insert.run("Mechanical Gaming Keyboard", 7999, 30);
    });
    seedTransaction();
  }

  dbInstance = db;
  return dbInstance;
}

export function getAllProducts(): Product[] {
  const db = getDb();
  return db.prepare("SELECT id, name, priceCents, stock FROM products ORDER BY id ASC").all() as Product[];
}

export function addProduct(product: Omit<Product, "id">): Product {
  const db = getDb();
  const stmt = db.prepare("INSERT INTO products (name, priceCents, stock) VALUES (?, ?, ?)");
  const info = stmt.run(product.name, product.priceCents, product.stock);
  const id = Number(info.lastInsertRowid);
  return {
    id,
    name: product.name,
    priceCents: product.priceCents,
    stock: product.stock
  };
}
