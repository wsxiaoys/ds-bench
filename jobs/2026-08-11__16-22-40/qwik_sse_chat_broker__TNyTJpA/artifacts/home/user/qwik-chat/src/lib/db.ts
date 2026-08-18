import Database from 'better-sqlite3';
import path from 'node:path';

const globalInit = globalThis as any;

if (!globalInit.db) {
  const dbPath = path.join(process.cwd(), 'chat.db');
  const db = new Database(dbPath);
  
  // Enable WAL mode for better concurrency if needed, but standard is fine too
  db.pragma('journal_mode = WAL');

  // Create messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      room TEXT NOT NULL,
      seq INTEGER NOT NULL,
      user TEXT NOT NULL,
      text TEXT NOT NULL,
      ts INTEGER NOT NULL,
      PRIMARY KEY (room, seq)
    );
    CREATE INDEX IF NOT EXISTS idx_messages_room_seq ON messages (room, seq);
  `);

  globalInit.db = db;
}

export const db = globalInit.db as any;
