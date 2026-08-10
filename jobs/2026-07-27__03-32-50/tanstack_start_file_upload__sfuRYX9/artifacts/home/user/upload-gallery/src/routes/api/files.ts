import { createFileRoute } from '@tanstack/react-router'
import { listFiles, toApiShape } from '~/server/db'

export const Route = createFileRoute('/api/files')({
  server: {
    handlers: {
      GET: async () => {
        const files = listFiles().map(toApiShape)
        return Response.json(files, { status: 200 })
      },
    },
  },
})
