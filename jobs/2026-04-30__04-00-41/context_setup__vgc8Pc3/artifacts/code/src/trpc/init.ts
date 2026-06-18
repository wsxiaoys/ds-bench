import { initTRPC } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';

/**
 * Creates the tRPC context from the incoming Request.
 * Extracts the `x-user-id` header (defaulting to `'anonymous'` if missing).
 */
export async function createContext({ req }: FetchCreateContextFnOptions) {
  const userId = req.headers.get('x-user-id') ?? 'anonymous';
  return { userId };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
