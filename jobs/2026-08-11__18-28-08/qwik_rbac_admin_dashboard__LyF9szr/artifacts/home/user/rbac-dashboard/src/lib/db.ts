import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'db.sqlite');
export const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
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
    expiresAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Seed data if empty
const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
if (userCount === 0) {
  const insertUser = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
  insertUser.run('admin', 'Admin#123', 'admin');
  insertUser.run('editor', 'Editor#123', 'editor');
  insertUser.run('viewer', 'Viewer#123', 'viewer');
}

const contentCount = (db.prepare('SELECT COUNT(*) as count FROM content').get() as { count: number }).count;
if (contentCount === 0) {
  const insertContent = db.prepare('INSERT INTO content (title, body) VALUES (?, ?)');
  insertContent.run('Getting Started', 'Welcome to the dashboard');
  insertContent.run('Company Roadmap', 'Plans for the next quarter');
}

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'editor' | 'viewer';
}

export interface Session {
  id: string;
  userId: number;
  expiresAt: number;
}

export interface Content {
  id: number;
  title: string;
  body: string;
}
