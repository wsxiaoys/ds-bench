import type { CreateNextContextOptions } from '@trpc/server/adapters/next';

export async function createContext(opts: CreateNextContextOptions) {
  const rawInput = opts.info.calls[0]
    ? await opts.info.calls[0].getRawInput()
    : undefined;

  return {
    req: opts.req,
    res: opts.res,
    rawInput,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
