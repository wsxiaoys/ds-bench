import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { incrementCountFn } from '../../../lib/counterFn'

export const Route = createFileRoute('/api/counter/increment')({
  server: {
    handlers: {
      POST: async () => {
        const result = await incrementCountFn()
        return json(result)
      },
    },
  },
})
