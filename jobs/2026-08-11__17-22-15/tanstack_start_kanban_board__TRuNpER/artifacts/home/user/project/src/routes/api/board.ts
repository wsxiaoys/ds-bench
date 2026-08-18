import { createFileRoute } from '@tanstack/react-router'
import { getBoardState } from '../../db'

export const Route = createFileRoute('/api/board')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const board = getBoardState()
          return Response.json(board)
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
