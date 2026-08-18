import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'counter.db')
const db = new Database(dbPath)

// Initialize the database on module load (server boot)
db.exec(`
  CREATE TABLE IF NOT EXISTS counter (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    count INTEGER NOT NULL DEFAULT 0
  );
`)

// Seed the table if it's empty
const row = db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number } | undefined
if (!row) {
  db.prepare('INSERT INTO counter (id, count) VALUES (1, 0)').run()
}

export function getCount(): number {
  const row = db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number }
  return row.count
}

export function incrementCount(): number {
  const transaction = db.transaction(() => {
    db.prepare('UPDATE counter SET count = count + 1 WHERE id = 1').run()
    const row = db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number }
    return row.count
  })
  return transaction()
}
