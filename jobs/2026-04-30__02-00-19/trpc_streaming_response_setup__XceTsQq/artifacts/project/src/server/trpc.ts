import { initTRPC } from '@trpc/server';
import type { NextRequest } from 'next/server';

interface CreateContextOptions {
  headers: Headers;
}

/**
 * This is the actual context you will use in your router. It will be used to
 * process every request that goes through your tRPC endpoint.
 */
export function createContext(opts: CreateContextOptions) {
  const source = opts.headers.get('x-trpc-source') ?? 'unknown';
  return { source };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 */
export const router = t.router;
export const publicProcedure = t.procedure;