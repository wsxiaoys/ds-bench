import { createAPIFileRoute } from '@tanstack/react-start/api'
import { getFile, deleteFile } from '../../db'

export const APIRoute = createAPIFileRoute('/api/files/$id')({
  GET: async ({ params }) => {
    try {
      const id = Number(params.id)
      if (isNaN(id)) {
        return new Response(JSON.stringify({ error: 'Invalid file ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const file = getFile(id)
      if (!file) {
        return new Response(JSON.stringify({ error: 'File not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return new Response(file.bytes, {
        status: 200,
        headers: {
          'Content-Type': file.metadata.mime
        }
      })
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Failed to fetch file' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  },
  DELETE: async ({ params }) => {
    try {
      const id = Number(params.id)
      if (isNaN(id)) {
        return new Response(JSON.stringify({ error: 'Invalid file ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const success = deleteFile(id)
      if (!success) {
        return new Response(JSON.stringify({ error: 'File not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Failed to delete file' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
})
