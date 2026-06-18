import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'counter.db');

const db = new Database(dbPath);

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS counter (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    count INTEGER NOT NULL DEFAULT 0
  );
`);

// Seed if empty
const row = db.prepare('SELECT count FROM counter WHERE id = 1').get();
if (!row) {
  db.prepare('INSERT INTO counter (id, count) VALUES (1, 0)').run();
}

export function getCount(): number {
  const row = db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number } | undefined;
  return row ? row.count : 0;
}

export function incrementCount(): number {
  db.prepare('UPDATE counter SET count = count + 1 WHERE id = 1').run();
  return getCount();
}
