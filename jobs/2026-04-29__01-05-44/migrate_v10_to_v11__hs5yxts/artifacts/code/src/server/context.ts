import * as trpcNext from '@trpc/server/adapters/next';

export async function createContext(opts: trpcNext.CreateNextContextOptions) {
  return {
    req: opts.req,
    res: opts.res,
    rawInput: opts.info?.calls[0]?.getRawInput(),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
