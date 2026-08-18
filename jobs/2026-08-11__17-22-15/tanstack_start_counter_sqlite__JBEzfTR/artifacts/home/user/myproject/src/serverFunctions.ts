import { createServerFn } from '@tanstack/react-start'
import { getCount, incrementCount } from './db'

export const getCounterFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  return getCount()
})

export const incrementCounterFn = createServerFn({
  method: 'POST',
}).handler(async () => {
  return incrementCount()
})
