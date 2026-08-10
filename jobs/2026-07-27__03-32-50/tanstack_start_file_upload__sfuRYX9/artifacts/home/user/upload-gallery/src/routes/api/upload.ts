import { createFileRoute } from '@tanstack/react-router'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { UPLOADS_DIR, insertFile, toApiShape } from '~/server/db'
import { MAX_FILE_SIZE, isAllowedMimeType } from '~/server/validation'

export const Route = createFileRoute('/api/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let formData: FormData
        try {
          formData = await request.formData()
        } catch {
          return Response.json(
            { error: 'Request must be multipart/form-data.' },
            { status: 400 },
          )
        }

        const file = formData.get('file')
        if (!(file instanceof File)) {
          return Response.json(
            { error: 'Missing file under form field "file".' },
            { status: 400 },
          )
        }

        const mime = file.type
        if (!isAllowedMimeType(mime)) {
          return Response.json(
            {
              error: `File type "${mime || 'unknown'}" is not allowed. Allowed types: image/png, image/jpeg, image/gif, image/webp.`,
            },
            { status: 400 },
          )
        }

        if (file.size > MAX_FILE_SIZE) {
          return Response.json(
            {
              error: `File size ${file.size} bytes exceeds the maximum allowed size of ${MAX_FILE_SIZE} bytes.`,
            },
            { status: 400 },
          )
        }

        const diskFilename = randomUUID()
        const buffer = Buffer.from(await file.arrayBuffer())
        await writeFile(path.join(UPLOADS_DIR, diskFilename), buffer)

        const record = insertFile({
          filename: file.name || 'upload',
          size: file.size,
          mime,
          uploadedAt: new Date().toISOString(),
          diskFilename,
        })

        return Response.json(toApiShape(record), { status: 201 })
      },
    },
  },
})
