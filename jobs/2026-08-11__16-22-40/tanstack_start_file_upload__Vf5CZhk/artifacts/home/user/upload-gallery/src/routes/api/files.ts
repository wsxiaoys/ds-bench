import { createAPIFileRoute } from '@tanstack/react-start/api'
import { db } from '../../db'

export const APIRoute = createAPIFileRoute('/api/files')({
  GET: async () => {
    try {
      const stmt = db.prepare(`
        SELECT id, filename, size, mime, uploadedAt
        FROM files
        ORDER BY id DESC
      `)
      const files = stmt.all()

      return new Response(JSON.stringify(files), {
        status: 200,
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
