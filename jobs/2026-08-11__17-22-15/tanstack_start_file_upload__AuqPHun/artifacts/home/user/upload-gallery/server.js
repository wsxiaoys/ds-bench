import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import handler from './dist/server/server.js'

const DB_PATH = path.resolve('data/db.sqlite')
const UPLOADS_DIR = path.resolve('data/uploads')

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const db = new Database(DB_PATH)

// Create table if not exists
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

const app = new Hono()

// Serve built static assets from dist/client
app.use('/assets/*', serveStatic({ root: './dist/client' }))
app.use('/favicon.ico', serveStatic({ path: './dist/client/favicon.ico' }))

// API endpoints
// GET /api/files - respond with JSON array of metadata ordered most-recently-uploaded first
app.get('/api/files', (c) => {
  try {
    const stmt = db.prepare('SELECT id, filename, size, mime, uploadedAt FROM files ORDER BY id DESC')
    const files = stmt.all()
    return c.json(files, 200)
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

// GET /api/files/{id} - respond with raw bytes and Content-Type header
app.get('/api/files/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400)
  }

  try {
    const stmt = db.prepare('SELECT filepath, mime FROM files WHERE id = ?')
    const file = stmt.get(id)
    if (!file) {
      return c.text('Not Found', 404)
    }

    if (!fs.existsSync(file.filepath)) {
      return c.text('File on disk not found', 404)
    }

    const fileBytes = fs.readFileSync(file.filepath)
    return c.body(fileBytes, 200, {
      'Content-Type': file.mime
    })
  } catch (err) {
    return c.text(err.message, 500)
  }
})

// DELETE /api/files/{id} - delete file and metadata
app.delete('/api/files/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400)
  }

  try {
    const stmt = db.prepare('SELECT filepath FROM files WHERE id = ?')
    const file = stmt.get(id)
    if (!file) {
      return c.text('Not Found', 404)
    }

    // Delete from disk
    if (fs.existsSync(file.filepath)) {
      fs.unlinkSync(file.filepath)
    }

    // Delete from DB
    db.prepare('DELETE FROM files WHERE id = ?').run(id)

    return c.text('Deleted successfully', 200)
  } catch (err) {
    return c.text(err.message, 500)
  }
})

// POST /api/upload - accepts multipart/form-data
app.post('/api/upload', async (c) => {
  try {
    const body = await c.req.parseBody()
    const file = body['file']

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded or invalid file field' }, 400)
    }

    const size = file.size
    const mime = file.type
    const filename = file.name

    // Server-side validation
    // Maximum accepted file size is 2097152 bytes (2 MiB)
    if (size > 2097152) {
      return c.json({ error: 'File size exceeds 2 MiB limit' }, 400)
    }

    // Allowed MIME types are exactly: image/png, image/jpeg, image/gif, image/webp
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
    if (!allowedMimeTypes.includes(mime)) {
      return c.json({ error: 'Disallowed MIME type' }, 400)
    }

    const uploadedAt = new Date().toISOString()

    // We insert into DB first to get the unique auto-increment ID
    const insertStmt = db.prepare('INSERT INTO files (filename, size, mime, uploadedAt, filepath) VALUES (?, ?, ?, ?, ?)')
    const result = insertStmt.run(filename, size, mime, uploadedAt, '')
    const id = result.lastInsertRowid

    // Construct filepath using the ID
    const filepath = path.join(UPLOADS_DIR, `${id}`)
    
    // Write bytes to disk
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filepath, buffer)

    // Update the row with the actual filepath
    db.prepare('UPDATE files SET filepath = ? WHERE id = ?').run(filepath, id)

    // Respond with 201 and JSON body
    return c.json({
      id,
      filename,
      size,
      mime,
      uploadedAt
    }, 201)

  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

// Fallback all other requests to TanStack Start's fetch handler
app.all('*', async (c) => {
  try {
    return await handler.fetch(c.req.raw)
  } catch (err) {
    console.error('Error in TanStack Start handler:', err)
    return c.text('Internal Server Error', 500)
  }
})

const PORT = 4813
console.log(`Server running on http://127.0.0.1:${PORT}`)
serve({
  fetch: app.fetch,
  port: PORT,
  hostname: '127.0.0.1'
})
