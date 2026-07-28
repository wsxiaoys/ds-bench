// Durable storage layer: SQLite for metadata, local disk for file bytes.
// This module is only ever imported from server-only route handlers, so it
// is safe to use Node built-ins here. Uses Node's built-in `node:sqlite`
// module (no native compilation required).
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const DATA_DIR = process.env.GALLERY_DATA_DIR || path.join(process.cwd(), 'data')
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
const DB_PATH = path.join(DATA_DIR, 'gallery.sqlite')

fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    disk_filename TEXT NOT NULL
  )
`)

export interface FileRecord {
  id: number
  filename: string
  size: number
  mime: string
  uploaded_at: string
  disk_filename: string
}

export interface FileMeta {
  id: number
  filename: string
  size: number
  mime: string
  uploadedAt: string
}

export function toApiShape(record: FileRecord): FileMeta {
  return {
    id: record.id,
    filename: record.filename,
    size: record.size,
    mime: record.mime,
    uploadedAt: record.uploaded_at,
  }
}

export function insertFile(data: {
  filename: string
  size: number
  mime: string
  uploadedAt: string
  diskFilename: string
}): FileRecord {
  const stmt = db.prepare(
    `INSERT INTO files (filename, size, mime, uploaded_at, disk_filename) VALUES (?, ?, ?, ?, ?)`,
  )
  const info = stmt.run(
    data.filename,
    data.size,
    data.mime,
    data.uploadedAt,
    data.diskFilename,
  )
  return getFileById(Number(info.lastInsertRowid))!
}

export function listFiles(): Array<FileRecord> {
  return db
    .prepare(`SELECT * FROM files ORDER BY id DESC`)
    .all() as Array<FileRecord>
}

export function getFileById(id: number): FileRecord | undefined {
  return db.prepare(`SELECT * FROM files WHERE id = ?`).get(id) as
    | FileRecord
    | undefined
}

export function deleteFileById(id: number): boolean {
  const info = db.prepare(`DELETE FROM files WHERE id = ?`).run(id)
  return info.changes > 0
}
