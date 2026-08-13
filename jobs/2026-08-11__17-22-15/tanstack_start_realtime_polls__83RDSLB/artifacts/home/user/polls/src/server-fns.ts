import { createServerFn } from '@tanstack/react-start'
import { listAllPolls, getPoll, createPoll, hasClientVoted } from './db'
import { getCookie } from '@tanstack/react-start/server'

export const getPollsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    return await listAllPolls()
  })

export const getPollFn = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const poll = await getPoll(id)
    if (!poll) return null

    // Check if current client has voted
    const clientId = getCookie('client_id')
    let hasVoted = false
    if (clientId) {
      hasVoted = await hasClientVoted(id, clientId)
    }

    return {
      poll,
      hasVoted
    }
  })

export const createPollFn = createServerFn({ method: 'POST' })
  .validator((data: { question: string; options: string[] }) => data)
  .handler(async ({ data }) => {
    return await createPoll(data.question, data.options)
  })
