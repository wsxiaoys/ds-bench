import { inferAsyncReturnType } from '@trpc/server';
import * as trpcNext from '@trpc/server/adapters/next';

export async function createContext(opts: trpcNext.CreateNextContextOptions) {
  // In tRPC v11, procedure input is no longer directly available on the context
  // options. Use info.calls[0].getRawInput() to access raw request data before
  // the procedure executes.
  const rawInput = opts.info.calls.length > 0
    ? await opts.info.calls[0].getRawInput()
    : undefined;

  return {
    req: opts.req,
    res: opts.res,
    rawInput,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
