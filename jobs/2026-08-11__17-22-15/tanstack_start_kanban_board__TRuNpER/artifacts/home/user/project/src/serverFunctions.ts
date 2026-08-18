import { createServerFn } from '@tanstack/react-start'
import { getBoardState, moveCard } from './db'

export const getBoardStateFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    return getBoardState()
  })

export const moveCardFn = createServerFn({ method: 'POST' })
  .validator((data: { cardId: number; columnId: string; position: number }) => data)
  .handler(async ({ data }) => {
    moveCard(data.cardId, data.columnId, data.position)
    return { success: true }
  })
