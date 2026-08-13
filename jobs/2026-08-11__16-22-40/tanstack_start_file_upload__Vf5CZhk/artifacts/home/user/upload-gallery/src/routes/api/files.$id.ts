import { createAPIFileRoute } from '@tanstack/react-start/api'
import { db } from '../../db'
import fs from 'fs'

type StoredFile = {
  id: number
  filename: string
  size: number
  mime: string
  uploadedAt: string
  filepath: string
}

export const APIRoute = createAPIFileRoute('/api/files/$id')({
  GET: async ({ params }) => {
    try {
      const id = Number(params.id)
      if (isNaN(id)) {
        return new Response('Invalid ID', { status: 400 })
      }

      const fileRecord = db.prepare(`SELECT * FROM files WHERE id = ?`).get(id) as StoredFile | undefined
      if (!fileRecord || !fs.existsSync(fileRecord.filepath)) {
        return new Response('Not Found', { status: 404 })
      }

      const fileBytes = await fs.promises.readFile(fileRecord.filepath)
      return new Response(fileBytes, {
        status: 200,
        headers: {
          'Content-Type': fileRecord.mime,
        },
      })
    } catch (error: any) {
      return new Response(error.message || 'Internal server error', { status: 500 })
    }
  },

  DELETE: async ({ params }) => {
    try {
      const id = Number(params.id)
      if (isNaN(id)) {
        return new Response('Invalid ID', { status: 400 })
      }

      const fileRecord = db.prepare(`SELECT * FROM files WHERE id = ?`).get(id) as StoredFile | undefined
      if (!fileRecord) {
        return new Response('Not Found', { status: 404 })
      }

      // Delete from disk if exists
      if (fs.existsSync(fileRecord.filepath)) {
        try {
          await fs.promises.unlink(fileRecord.filepath)
        } catch (err) {
          // Ignore disk delete errors or log them
        }
      }

      // Delete from SQLite
      db.prepare(`DELETE FROM files WHERE id = ?`).run(id)

      return new Response('Deleted successfully', { status: 200 })
    } catch (error: any) {
      return new Response(error.message || 'Internal server error', { status: 500 })
    }
  },
})
