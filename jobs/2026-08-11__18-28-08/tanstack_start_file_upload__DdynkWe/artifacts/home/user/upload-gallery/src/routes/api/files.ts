import { createAPIFileRoute } from '@tanstack/react-start/api'
import { getFiles } from '../../db'

export const APIRoute = createAPIFileRoute('/api/files')({
  GET: async () => {
    try {
      const files = getFiles()
      return new Response(JSON.stringify(files), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Failed to fetch files' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
})
