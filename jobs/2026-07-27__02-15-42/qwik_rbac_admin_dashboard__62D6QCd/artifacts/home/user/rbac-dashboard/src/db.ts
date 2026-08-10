import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { join } from 'path';

let dbPromise: Promise<Database<sqlite3.Database, sqlite3.Statement>> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      // Use absolute or relative path to project directory
      const dbPath = join(process.cwd(), 'database.sqlite');
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      // Enable foreign keys
      await db.run('PRAGMA foreign_keys = ON');

      // Create tables
      await db.exec(`
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
          user_id INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
      `);

      // Seed users if empty
      const userCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
      if (userCount && userCount.count === 0) {
        await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 'admin', 'Admin#123', 'admin');
        await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 'editor', 'Editor#123', 'editor');
        await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 'viewer', 'Viewer#123', 'viewer');
      }

      // Seed content if empty
      const contentCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM content');
      if (contentCount && contentCount.count === 0) {
        await db.run('INSERT INTO content (title, body) VALUES (?, ?)', 'Getting Started', 'Welcome to the dashboard');
        await db.run('INSERT INTO content (title, body) VALUES (?, ?)', 'Company Roadmap', 'Plans for the next quarter');
      }

      return db;
    })();
  }
  return dbPromise;
}
