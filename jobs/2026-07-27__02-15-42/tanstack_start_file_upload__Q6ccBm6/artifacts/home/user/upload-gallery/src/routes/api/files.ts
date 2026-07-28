import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '../../lib/db'

export const Route = createFileRoute('/api/files')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const db = await getDb()
          const files = await db.all(
            'SELECT id, filename, size, mime, uploadedAt FROM files ORDER BY id DESC'
          )

          return new Response(JSON.stringify(files), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error: any) {
          console.error('List files error:', error)
          return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
})
