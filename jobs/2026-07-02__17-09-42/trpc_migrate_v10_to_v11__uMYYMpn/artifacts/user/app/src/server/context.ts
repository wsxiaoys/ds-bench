import { inferAsyncReturnType } from '@trpc/server';
import * as trpcNext from '@trpc/server/adapters/next';

export async function createContext(opts: trpcNext.CreateNextContextOptions) {
  const { req, res, info } = opts;
  const rawInput = await info.calls[0].getRawInput();
  return {
    req,
    res,
    rawInput,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;