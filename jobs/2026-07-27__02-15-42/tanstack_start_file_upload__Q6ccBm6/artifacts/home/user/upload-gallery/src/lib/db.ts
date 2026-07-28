import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.resolve('./data')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
const DB_PATH = path.join(DATA_DIR, 'database.sqlite')

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

let dbPromise = open({
  filename: DB_PATH,
  driver: sqlite3.Database
}).then(async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime TEXT NOT NULL,
      uploadedAt TEXT NOT NULL
    )
  `)
  return db
})

export async function getDb() {
  return dbPromise
}

export { UPLOADS_DIR }
