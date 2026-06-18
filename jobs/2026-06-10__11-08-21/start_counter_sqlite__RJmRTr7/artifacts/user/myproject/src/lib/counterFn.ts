import { createServerFn } from '@tanstack/react-start'
import { getCount, incrementCount } from './db'

export const getCountFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  return { count: getCount() }
})

export const incrementCountFn = createServerFn({
  method: 'POST',
}).handler(async () => {
  const newCount = incrementCount()
  return { count: newCount }
})
