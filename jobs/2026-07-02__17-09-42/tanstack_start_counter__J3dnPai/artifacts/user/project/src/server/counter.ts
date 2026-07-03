import { createServerFn } from '@tanstack/react-start'

// In-memory counter state kept on the server.
let count = 0

export const getCount = createServerFn({ method: 'GET' }).handler(() => {
  return count
})

export const incrementCount = createServerFn({ method: 'POST' }).handler(
  () => {
    count += 1
    return count
  },
)