import { createServerFn } from '@tanstack/react-start'
import { incrementCount, readCount } from '../db'
import { getDb } from '../db'

// Ensure the database is initialized before any handler runs.
getDb()

export const getCounter = createServerFn({ method: 'GET' }).handler(async () => {
  return { count: readCount() }
})

export const incrementCounter = createServerFn({ method: 'POST' }).handler(async () => {
  const count = incrementCount()
  return { count }
})
