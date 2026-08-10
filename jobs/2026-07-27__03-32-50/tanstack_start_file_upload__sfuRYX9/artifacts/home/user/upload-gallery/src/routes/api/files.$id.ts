import { createFileRoute } from '@tanstack/react-router'
import { readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { UPLOADS_DIR, deleteFileById, getFileById } from '~/server/db'

function parseId(raw: string): number | undefined {
  const id = Number(raw)
  return Number.isInteger(id) ? id : undefined
}

export const Route = createFileRoute('/api/files/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = parseId(params.id)
        const record = id === undefined ? undefined : getFileById(id)
        if (!record) {
          return Response.json({ error: 'File not found.' }, { status: 404 })
        }

        try {
          const data = await readFile(
            path.join(UPLOADS_DIR, record.disk_filename),
          )
          return new Response(data, {
            status: 200,
            headers: {
              'Content-Type': record.mime,
              'Content-Length': String(record.size),
            },
          })
        } catch {
          return Response.json({ error: 'File not found.' }, { status: 404 })
        }
      },
      DELETE: async ({ params }) => {
        const id = parseId(params.id)
        const record = id === undefined ? undefined : getFileById(id)
        if (!record) {
          return Response.json({ error: 'File not found.' }, { status: 404 })
        }

        deleteFileById(record.id)
        try {
          await unlink(path.join(UPLOADS_DIR, record.disk_filename))
        } catch {
          // File bytes already missing on disk; metadata removal still succeeds.
        }

        return Response.json({ ok: true }, { status: 200 })
      },
    },
  },
})
