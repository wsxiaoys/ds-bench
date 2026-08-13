import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.resolve(process.cwd(), 'data')
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads')

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const dbPath = path.resolve(DATA_DIR, 'gallery.db')
const db = new Database(dbPath)

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime TEXT NOT NULL,
    uploadedAt TEXT NOT NULL,
    filepath TEXT NOT NULL
  )
`)

export { db, UPLOADS_DIR }
export type StoredFile = {
  id: number
  filename: string
  size: number
  mime: string
  uploadedAt: string
  filepath: string
}
