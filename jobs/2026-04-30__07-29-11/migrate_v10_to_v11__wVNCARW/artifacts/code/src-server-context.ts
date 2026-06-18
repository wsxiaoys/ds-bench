import { inferAsyncReturnType } from '@trpc/server';
import * as trpcNext from '@trpc/server/adapters/next';

export async function createContext(opts: trpcNext.CreateNextContextOptions) {
  const rawInput = await opts.info.calls[0]?.getRawInput();

  return {
    req: opts.req,
    res: opts.res,
    rawInput,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
