import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import bcrypt from 'bcryptjs'

const dbDir = '/home/user/project/data'
const dbPath = path.join(dbDir, 'app.sqlite')

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

export const db = new Database(dbPath)

// Enable foreign keys
db.pragma('foreign_keys = ON')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(email) REFERENCES users(email) ON DELETE CASCADE
  );
`)

// Seed if users table is empty
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
  for (const u of seedUsers) {
    const hash = bcrypt.hashSync(u.password, 10)
    insert.run(u.email, hash, u.role)
  }
}
