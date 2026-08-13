import Database from "better-sqlite3";
import { randomBytes, createHash } from "crypto";

const dbPath = "/home/user/qwik-app/db.sqlite";

// Open the database
export const db = new Database(dbPath);

// Enable WAL mode for better concurrency and to prevent database locking issues
db.pragma("journal_mode = WAL");

// Initialize the table if it does not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    hashed_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active', 'revoked')),
    created_at TEXT NOT NULL
  )
`);

export interface ApiKeyRow {
  id: number;
  name: string;
  key_prefix: string;
  hashed_key: string;
  status: "active" | "revoked";
  created_at: string;
}

export function generateApiKey(): { key: string; prefix: string; hashedKey: string } {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomStr = "";
  const bytes = randomBytes(32);
  for (let i = 0; i < 32; i++) {
    randomStr += chars[bytes[i] % chars.length];
  }
  
  const key = `qk_${randomStr}`;
  const prefix = key.slice(0, 7); // First 7 characters: e.g. 'qk_abcd'
  
  const hashedKey = hashKey(key);
  
  return { key, prefix, hashedKey };
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
