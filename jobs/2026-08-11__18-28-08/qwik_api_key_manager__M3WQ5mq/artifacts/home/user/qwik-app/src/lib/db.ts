import Database from 'better-sqlite3';

const dbPath = '/home/user/qwik-app/db.sqlite';

// Initialize database with busy timeout of 5000ms to prevent locking issues
const db = new Database(dbPath, { timeout: 5000 });

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Ensure table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    hashed_key TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

export default db;
