import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export interface Post {
  id: number;
  slug: string;
  title: string;
  content: string;
  published: number; // 0 or 1
  created_at: string;
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dataDir = join(process.cwd(), "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = join(dataDir, "blog.db");
  const db = new Database(dbPath);

  // Create table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  dbInstance = db;
  return dbInstance;
}
