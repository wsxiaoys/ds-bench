import { createAPIFileRoute } from '@tanstack/react-start/api'
import { db, UPLOADS_DIR } from '../../db'
import fs from 'fs'
import path from 'path'

const MAX_SIZE = 2097152 // 2 MiB
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export const APIRoute = createAPIFileRoute('/api/upload')({
  POST: async ({ request }) => {
    try {
      const formData = await request.formData()
      const file = formData.get('file')

      if (!file || typeof file === 'string') {
        return new Response(JSON.stringify({ error: 'No file uploaded' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Validation
      if (file.size > MAX_SIZE) {
        return new Response(JSON.stringify({ error: 'File size exceeds limit of 2 MiB' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (!ALLOWED_MIMES.includes(file.type)) {
        return new Response(JSON.stringify({ error: 'MIME type not allowed' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Read file bytes
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Save to local filesystem
      const uniqueFilename = `${Date.now()}-${file.name}`
      const filepath = path.join(UPLOADS_DIR, uniqueFilename)
      await fs.promises.writeFile(filepath, buffer)

      // Record metadata in SQLite
      const uploadedAt = new Date().toISOString()
      const stmt = db.prepare(`
        INSERT INTO files (filename, size, mime, uploadedAt, filepath)
        VALUES (?, ?, ?, ?, ?)
      `)
      const result = stmt.run(file.name, file.size, file.type, uploadedAt, filepath)
      const id = Number(result.lastInsertRowid)

      return new Response(JSON.stringify({
        id,
        filename: file.name,
        size: file.size,
        mime: file.type,
        uploadedAt,
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
})
