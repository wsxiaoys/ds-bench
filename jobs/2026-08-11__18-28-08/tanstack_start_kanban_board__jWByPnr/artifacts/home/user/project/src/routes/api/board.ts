import { createServerFileRoute } from '@tanstack/react-start/server'
import { getBoard } from '../../db'

export const ServerRoute = createServerFileRoute('/api/board').methods({
  GET: async () => {
    try {
      const board = getBoard()
      return new Response(JSON.stringify(board), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }
  },
})
