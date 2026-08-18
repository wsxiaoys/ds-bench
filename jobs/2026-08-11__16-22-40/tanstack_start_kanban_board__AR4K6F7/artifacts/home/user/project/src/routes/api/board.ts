import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'
import { getBoard } from '../../db.server'

export const ServerRoute = createServerFileRoute('/api/board').methods({
  GET: async () => {
    try {
      const board = getBoard()
      return json(board)
    } catch (err: any) {
      return json({ error: err.message }, { status: 500 })
    }
  },
})
