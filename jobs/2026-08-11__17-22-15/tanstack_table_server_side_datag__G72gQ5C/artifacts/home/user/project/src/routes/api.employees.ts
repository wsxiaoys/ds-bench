import { createFileRoute } from '@tanstack/react-router'
import { strictQuerySchema } from '../schemas'
import { queryEmployees } from '../utils/employees'

export const Route = createFileRoute('/api/employees')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const params = Object.fromEntries(url.searchParams.entries())

        const result = strictQuerySchema.safeParse(params)
        if (!result.success) {
          const errorMsg = result.error.errors
            .map((err) => `${err.path.join('.')}: ${err.message}`)
            .join(', ')
          return Response.json({ error: errorMsg }, { status: 400 })
        }

        const data = queryEmployees(result.data)
        return Response.json(data)
      },
    },
  },
})
