import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = '/home/user/qwik-app/gallery.db';

// Ensure parent directory of database exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Create the images table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL,
    original_path TEXT NOT NULL,
    optimized_path TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

export interface ImageRecord {
  id: number;
  original_name: string;
  original_path: string;
  optimized_path: string;
  width: number;
  height: number;
  uploaded_at: string;
}

export default db;
