import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

const dbDir = '/home/user/project/data'
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const dbPath = path.join(dbDir, 'app.sqlite')
const db = new Database(dbPath)

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL
  )
`)

// Create sessions table
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )
`)

// Seed users if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
if (userCount.count === 0) {
  const seedUsers = [
    { email: 'root@example.com', password: 'Adm1n!pass9', role: 'admin' },
    { email: 'member@example.com', password: 'Us3r!pass42', role: 'user' },
    { email: 'pat@example.com', password: 'Us3r!pass42', role: 'user' },
    { email: 'sam@example.com', password: 'Us3r!pass42', role: 'user' },
    { email: 'jordan@example.com', password: 'Us3r!pass42', role: 'user' },
  ]

  const insertUser = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
  for (const u of seedUsers) {
    const salt = bcrypt.genSaltSync(10)
    const hash = bcrypt.hashSync(u.password, salt)
    insertUser.run(u.email, hash, u.role)
  }
}

export { db }
export default db
