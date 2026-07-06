import Database from 'better-sqlite3';

const dbPath = '/home/user/myproject/counter.db';

const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize table and seed data
db.exec(`
  CREATE TABLE IF NOT EXISTS counter (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    count INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO counter (id, count) VALUES (1, 0);
`);

export default db;

export function getCount(): number {
  const row = db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number } | undefined;
  return row ? row.count : 0;
}

export function incrementCount(): number {
  return db.transaction(() => {
    db.prepare('UPDATE counter SET count = count + 1 WHERE id = 1').run();
    const row = db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number };
    return row.count;
  })();
}
