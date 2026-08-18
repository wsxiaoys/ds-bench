import Database from 'better-sqlite3';

const DB_PATH = '/home/user/qwik-app/db.sqlite';

const db = new Database(DB_PATH);

// Enable WAL mode for concurrent requests and to avoid database locking issues
db.pragma('journal_mode = WAL');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    hashed_key TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

export default db;
export { DB_PATH };
