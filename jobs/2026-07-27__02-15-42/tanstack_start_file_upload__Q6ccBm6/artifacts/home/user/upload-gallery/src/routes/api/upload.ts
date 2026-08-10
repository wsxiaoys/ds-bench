import { createFileRoute } from '@tanstack/react-router'
import { getDb, UPLOADS_DIR } from '../../lib/db'
import fs from 'fs/promises'
import path from 'path'

export const Route = createFileRoute('/api/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const formData = await request.formData()
          const file = formData.get('file')

          if (!file || !(file instanceof File)) {
            return new Response(JSON.stringify({ error: 'No file uploaded' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          const filename = file.name
          const size = file.size
          const mime = file.type

          // Server-side validation
          const maxSize = 2097152 // 2 MiB
          const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

          if (size > maxSize) {
            return new Response(JSON.stringify({ error: 'File size exceeds 2 MiB limit' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          if (!allowedMimeTypes.includes(mime)) {
            return new Response(JSON.stringify({ error: `MIME type ${mime} is not allowed` }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          const uploadedAt = new Date().toISOString()

          // Read file bytes
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          // Insert metadata to DB
          const db = await getDb()
          const result = await db.run(
            'INSERT INTO files (filename, size, mime, uploadedAt) VALUES (?, ?, ?, ?)',
            [filename, size, mime, uploadedAt]
          )

          const insertId = result.lastID
          if (insertId === undefined) {
            throw new Error('Failed to insert file metadata')
          }

          // Save file to disk with filename based on ID to avoid naming conflicts
          const filePath = path.join(UPLOADS_DIR, `${insertId}`)
          await fs.writeFile(filePath, buffer)

          return new Response(
            JSON.stringify({
              id: insertId,
              filename,
              size,
              mime,
              uploadedAt
            }),
            {
              status: 201,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        } catch (error: any) {
          console.error('Upload error:', error)
          return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
})
