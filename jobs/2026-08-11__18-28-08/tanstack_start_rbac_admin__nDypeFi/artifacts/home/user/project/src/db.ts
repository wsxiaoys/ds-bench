import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'

const dbDir = '/home/user/project/data'
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const dbPath = path.join(dbDir, 'app.sqlite')
const db = new Database(dbPath)

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

// Seed if empty
const countResult = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
if (countResult.count === 0) {
  const seedUsers = [
    { email: 'root@example.com', password: 'Adm1n!pass9', role: 'admin' },
    { email: 'member@example.com', password: 'Us3r!pass42', role: 'user' },
    { email: 'pat@example.com', password: 'Us3r!pass42', role: 'user' },
    { email: 'sam@example.com', password: 'Us3r!pass42', role: 'user' },
    { email: 'jordan@example.com', password: 'Us3r!pass42', role: 'user' },
  ]

  const insert = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
  for (const user of seedUsers) {
    const salt = bcrypt.genSaltSync(10)
    const hash = bcrypt.hashSync(user.password, salt)
    insert.run(user.email, hash, user.role)
  }
}

export default db

export interface DbUser {
  id: number
  email: string
  password_hash: string
  role: 'admin' | 'user'
}

export interface DbSession {
  id: string
  user_id: number
  expires_at: number
}

// Session Helpers
export function createSession(userId: number): { token: string; expiresAt: Date } {
  const token = randomUUID()
  // Session lasts for 24 hours
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt.getTime()
  )
  return { token, expiresAt }
}

export function getSession(token: string): { user: DbUser } | null {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(token) as DbSession | undefined
  if (!session) return null

  if (Date.now() > session.expires_at) {
    // Session expired, clean it up
    db.prepare('DELETE FROM sessions WHERE id = ?').run(token)
    return null
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as DbUser | undefined
  if (!user) return null

  return { user }
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(token)
}
