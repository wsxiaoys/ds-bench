import { createServerFn } from '@tanstack/react-start'

export const getPollsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { listPolls } = await import('./db')
  return listPolls()
})

export const getPollFn = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getPoll } = await import('./db')
    return getPoll(id)
  })
