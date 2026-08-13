import Database from 'better-sqlite3';
import { startBackgroundRunner } from './runner';

const dbPath = '/home/user/qwik-app/tasks.db';
export const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables if they do not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    interval_seconds INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAUSED'))
  );

  CREATE TABLE IF NOT EXISTS execution_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
    timestamp TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);

// Start the background runner when this module is loaded on the server
if (typeof window === 'undefined') {
  startBackgroundRunner();
}
