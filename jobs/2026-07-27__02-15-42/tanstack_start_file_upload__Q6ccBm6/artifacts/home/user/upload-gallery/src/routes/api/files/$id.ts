import { createFileRoute } from '@tanstack/react-router'
import { getDb, UPLOADS_DIR } from '../../../lib/db'
import fs from 'fs/promises'
import path from 'path'

export const Route = createFileRoute('/api/files/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { id } = params
          const db = await getDb()
          const fileMeta = await db.get('SELECT * FROM files WHERE id = ?', [id])

          if (!fileMeta) {
            return new Response(JSON.stringify({ error: 'File not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          const filePath = path.join(UPLOADS_DIR, `${id}`)
          try {
            const buffer = await fs.readFile(filePath)
            return new Response(buffer, {
              status: 200,
              headers: {
                'Content-Type': fileMeta.mime
              }
            })
          } catch (err: any) {
            if (err.code === 'ENOENT') {
              return new Response(JSON.stringify({ error: 'File bytes not found on disk' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
              })
            }
            throw err
          }
        } catch (error: any) {
          console.error('Get file error:', error)
          return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      },
      DELETE: async ({ params }) => {
        try {
          const { id } = params
          const db = await getDb()
          const fileMeta = await db.get('SELECT * FROM files WHERE id = ?', [id])

          if (!fileMeta) {
            return new Response(JSON.stringify({ error: 'File not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          // Delete from disk
          const filePath = path.join(UPLOADS_DIR, `${id}`)
          try {
            await fs.unlink(filePath)
          } catch (err: any) {
            if (err.code !== 'ENOENT') {
              throw err
            }
          }

          // Delete from database
          await db.run('DELETE FROM files WHERE id = ?', [id])

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error: any) {
          console.error('Delete file error:', error)
          return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
})
