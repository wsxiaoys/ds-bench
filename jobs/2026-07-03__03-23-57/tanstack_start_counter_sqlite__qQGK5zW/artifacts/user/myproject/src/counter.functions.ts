import { createServerFn } from '@tanstack/react-start'
import { getCount, incrementCount } from './db'

export const getCounter = createServerFn({
  method: 'GET',
}).handler(async () => {
  return getCount()
})

export const incrementCounter = createServerFn({
  method: 'POST',
}).handler(async () => {
  return incrementCount()
})
