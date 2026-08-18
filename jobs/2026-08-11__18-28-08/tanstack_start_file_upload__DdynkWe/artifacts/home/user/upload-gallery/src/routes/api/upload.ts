import { createAPIFileRoute } from '@tanstack/react-start/api'
import { saveFile } from '../../db'

export const APIRoute = createAPIFileRoute('/api/upload')({
  POST: async ({ request }) => {
    try {
      const formData = await request.formData()
      const file = formData.get('file')

      if (!file || typeof file === 'string') {
        return new Response(JSON.stringify({ error: 'No file uploaded' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Validation
      const allowedMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
      if (!allowedMimes.includes(file.type)) {
        return new Response(JSON.stringify({ error: 'Invalid MIME type' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (file.size > 2097152) {
        return new Response(JSON.stringify({ error: 'File size exceeds limit of 2 MiB' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const saved = saveFile(file.name, file.type, buffer)

      return new Response(JSON.stringify(saved), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Upload failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
})
