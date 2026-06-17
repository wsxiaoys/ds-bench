import Database from 'better-sqlite3';

const dbPath = 'counter.db';
const db = new Database(dbPath);

// Initialize table and seed
db.exec(`
  CREATE TABLE IF NOT EXISTS counter (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    count INTEGER NOT NULL
  );
  INSERT OR IGNORE INTO counter (id, count) VALUES (1, 0);
`);

export default db;
