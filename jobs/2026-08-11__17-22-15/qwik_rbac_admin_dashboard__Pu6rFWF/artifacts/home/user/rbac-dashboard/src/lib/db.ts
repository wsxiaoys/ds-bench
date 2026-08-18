import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'rbac.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userId INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Seed tables if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const insertUser = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
  insertUser.run('admin', 'Admin#123', 'admin');
  insertUser.run('editor', 'Editor#123', 'editor');
  insertUser.run('viewer', 'Viewer#123', 'viewer');
}

const contentCount = db.prepare('SELECT COUNT(*) as count FROM content').get() as { count: number };
if (contentCount.count === 0) {
  // Let's use INSERT INTO with explicit ids to ensure they are 1 and 2,
  // and set the auto-increment counter correctly
  const insertContent = db.prepare('INSERT INTO content (id, title, body) VALUES (?, ?, ?)');
  insertContent.run(1, 'Getting Started', 'Welcome to the dashboard');
  insertContent.run(2, 'Company Roadmap', 'Plans for the next quarter');
}

export { db };
export interface User {
  id: number;
  username: string;
  role: string;
}
export interface Session {
  id: string;
  userId: number;
  createdAt: number;
}
export interface Content {
  id: number;
  title: string;
  body: string;
}
