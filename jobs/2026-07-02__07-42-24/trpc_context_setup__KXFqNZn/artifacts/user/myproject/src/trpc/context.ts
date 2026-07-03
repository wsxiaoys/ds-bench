import { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';

export async function createContext(opts: FetchCreateContextFnOptions) {
  const userId = opts.req.headers.get('x-user-id') || 'anonymous';
  return {
    userId,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
