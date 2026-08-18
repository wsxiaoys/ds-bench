import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'counter.db');

const db = new Database(dbPath);

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS counter (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    count INTEGER NOT NULL DEFAULT 0
  )
`);

// Seed counter row if missing
const row = db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number } | undefined;
if (!row) {
  db.prepare('INSERT INTO counter (id, count) VALUES (1, 0)').run();
}

export function getCount(): number {
  const row = db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number };
  return row.count;
}

export function incrementCount(): number {
  // Use a transaction or a single atomic update to increment and select the new value
  let newCount = 0;
  db.transaction(() => {
    db.prepare('UPDATE counter SET count = count + 1 WHERE id = 1').run();
    const row = db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number };
    newCount = row.count;
  })();
  return newCount;
}

export default db;
