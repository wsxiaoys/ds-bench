import { createServerFn } from '@tanstack/react-start'
import { incrementAndRead, readCount } from './db'

/**
 * Single source of truth for counter mutations. The REST endpoint and any UI
 * call site that wants to bump the counter MUST go through this function
 * (or its underlying `incrementAndRead` helper) so the atomic UPDATE lives
 * in exactly one place.
 */
export const incrementCounter = createServerFn({ method: 'POST' }).handler(
  async () => {
    const count = incrementAndRead()
    return { count }
  },
)

/** Reads the current counter value. Used by the SSR loader and the GET endpoint. */
export const getCounter = createServerFn({ method: 'GET' }).handler(async () => {
  const count = readCount()
  return { count }
})
