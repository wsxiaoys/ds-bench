import { createServerFn } from '@tanstack/react-start'

let counter = 0

export const getCounter = createServerFn({ method: 'GET' }).handler(() => {
  return counter
})

export const incrementCounter = createServerFn({ method: 'POST' }).handler(() => {
  counter += 1
  return counter
})
