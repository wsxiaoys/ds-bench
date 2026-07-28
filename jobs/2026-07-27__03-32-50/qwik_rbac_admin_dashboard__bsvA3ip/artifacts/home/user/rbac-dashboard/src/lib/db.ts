/**
 * Server-only SQLite access layer.
 *
 * This module is only ever imported from Qwik City server boundaries
 * (`plugin.ts` middleware, `routeLoader$`, and endpoint `onGet`/`onPost`/
 * `onDelete` handlers), so `better-sqlite3` never ends up in a client bundle.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { generateSalt, hashPassword } from './crypto';

export type Role = 'admin' | 'editor' | 'viewer';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  salt: string;
  role: Role;
}

export interface PublicUser {
  id: number;
  username: string;
  role: Role;
}

export interface ContentRow {
  id: number;
  title: string;
  body: string;
}

let db: Database.Database | null = null;

function seed(database: Database.Database) {
  const userCount = (database.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;

  if (userCount === 0) {
    const insertUser = database.prepare(
      'INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)',
    );

    const seedUsers: Array<{ username: string; password: string; role: Role }> = [
      { username: 'admin', password: 'Admin#123', role: 'admin' },
      { username: 'editor', password: 'Editor#123', role: 'editor' },
      { username: 'viewer', password: 'Viewer#123', role: 'viewer' },
    ];

    for (const user of seedUsers) {
      const salt = generateSalt();
      const passwordHash = hashPassword(user.password, salt);
      insertUser.run(user.username, passwordHash, salt, user.role);
    }
  }

  const contentCount = (database.prepare('SELECT COUNT(*) as c FROM content').get() as { c: number }).c;

  if (contentCount === 0) {
    const insertContent = database.prepare('INSERT INTO content (title, body) VALUES (?, ?)');
    insertContent.run('Getting Started', 'Welcome to the dashboard');
    insertContent.run('Company Roadmap', 'Plans for the next quarter');
  }
}

export function getDb(): Database.Database {
  if (db) {
    return db;
  }

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'app.db');
  const instance = new Database(dbPath);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');

  instance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer'))
    );

    CREATE TABLE IF NOT EXISTS content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
  `);

  seed(instance);

  db = instance;
  return db;
}

export function findUserByUsername(username: string): UserRow | undefined {
  return getDb()
    .prepare('SELECT id, username, password_hash, salt, role FROM users WHERE username = ?')
    .get(username) as UserRow | undefined;
}

export function findUserById(id: number): UserRow | undefined {
  return getDb()
    .prepare('SELECT id, username, password_hash, salt, role FROM users WHERE id = ?')
    .get(id) as UserRow | undefined;
}

export function listUsers(): PublicUser[] {
  return getDb().prepare('SELECT id, username, role FROM users ORDER BY id').all() as PublicUser[];
}

export function createUser(username: string, password: string, role: Role): PublicUser {
  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  const result = getDb()
    .prepare('INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)')
    .run(username, passwordHash, salt, role);
  return { id: Number(result.lastInsertRowid), username, role };
}

export function listContent(): ContentRow[] {
  return getDb().prepare('SELECT id, title, body FROM content ORDER BY id').all() as ContentRow[];
}

export function createContent(title: string, body: string): ContentRow {
  const result = getDb().prepare('INSERT INTO content (title, body) VALUES (?, ?)').run(title, body);
  return { id: Number(result.lastInsertRowid), title, body };
}

export function deleteContent(id: number): boolean {
  const result = getDb().prepare('DELETE FROM content WHERE id = ?').run(id);
  return result.changes > 0;
}
