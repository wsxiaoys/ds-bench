import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const dbPath = path.resolve(process.cwd(), 'db.sqlite')
const uploadsDir = path.resolve(process.cwd(), 'uploads')

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const db = new Database(dbPath)

// Create files table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime TEXT NOT NULL,
    uploadedAt TEXT NOT NULL
  )
`)

export interface FileMetadata {
  id: number
  filename: string
  size: number
  mime: string
  uploadedAt: string
}

export function saveFile(filename: string, mime: string, buffer: Buffer): FileMetadata {
  const size = buffer.length
  const uploadedAt = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO files (filename, size, mime, uploadedAt)
    VALUES (?, ?, ?, ?)
  `)
  const result = stmt.run(filename, size, mime, uploadedAt)
  const id = Number(result.lastInsertRowid)

  // Write file to disk using ID as the filename
  const filePath = path.join(uploadsDir, `${id}`)
  fs.writeFileSync(filePath, buffer)

  return {
    id,
    filename,
    size,
    mime,
    uploadedAt
  }
}

export function getFiles(): FileMetadata[] {
  const stmt = db.prepare(`
    SELECT id, filename, size, mime, uploadedAt
    FROM files
    ORDER BY id DESC
  `)
  return stmt.all() as FileMetadata[]
}

export function getFile(id: number): { metadata: FileMetadata; bytes: Buffer } | null {
  const stmt = db.prepare(`
    SELECT id, filename, size, mime, uploadedAt
    FROM files
    WHERE id = ?
  `)
  const metadata = stmt.get(id) as FileMetadata | undefined
  if (!metadata) return null

  const filePath = path.join(uploadsDir, `${id}`)
  if (!fs.existsSync(filePath)) return null

  const bytes = fs.readFileSync(filePath)
  return { metadata, bytes }
}

export function deleteFile(id: number): boolean {
  const stmt = db.prepare(`
    SELECT id FROM files WHERE id = ?
  `)
  const metadata = stmt.get(id)
  if (!metadata) return false

  // Delete from DB first
  const deleteStmt = db.prepare(`
    DELETE FROM files WHERE id = ?
  `)
  deleteStmt.run(id)

  // Delete from disk
  const filePath = path.join(uploadsDir, `${id}`)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }

  return true
}
