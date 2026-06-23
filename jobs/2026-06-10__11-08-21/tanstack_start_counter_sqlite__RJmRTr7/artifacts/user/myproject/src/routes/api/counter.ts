import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getCountFn } from '../../lib/counterFn'

export const Route = createFileRoute('/api/counter')({
  server: {
    handlers: {
      GET: async () => {
        const result = await getCountFn()
        return json(result)
      },
    },
  },
})
