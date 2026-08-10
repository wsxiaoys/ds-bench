// Server-only: SQLite persistence for users and sessions.
// This module must never be imported from client code.
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const DB_PATH = '/home/user/tanstack-auth/data/app.db'

mkdirSync(dirname(DB_PATH), { recursive: true })

let dbInstance: DatabaseSync | null = null

function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance

  const db = new DatabaseSync(DB_PATH)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)

  dbInstance = db
  return db
}

export interface UserRow {
  id: number
  username: string
  password_hash: string
  created_at: number
}

export interface SessionRow {
  id: string
  user_id: number
  created_at: number
  expires_at: number
}

export function createUser(username: string, passwordHash: string): UserRow {
  const db = getDb()
  const stmt = db.prepare(
    'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
  )
  const info = stmt.run(username, passwordHash, Date.now())
  return findUserById(Number(info.lastInsertRowid))!
}

export function findUserByUsername(username: string): UserRow | undefined {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?')
  return stmt.get(username) as UserRow | undefined
}

export function findUserById(id: number): UserRow | undefined {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
  return stmt.get(id) as UserRow | undefined
}

export function createSession(
  sessionId: string,
  userId: number,
  expiresAt: number,
): void {
  const db = getDb()
  const stmt = db.prepare(
    'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  )
  stmt.run(sessionId, userId, Date.now(), expiresAt)
}

export function findSession(sessionId: string): SessionRow | undefined {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?')
  return stmt.get(sessionId) as SessionRow | undefined
}

export function deleteSession(sessionId: string): void {
  const db = getDb()
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?')
  stmt.run(sessionId)
}
