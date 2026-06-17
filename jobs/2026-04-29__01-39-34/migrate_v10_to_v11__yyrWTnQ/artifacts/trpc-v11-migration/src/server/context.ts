import { inferAsyncReturnType } from '@trpc/server';
import * as trpcNext from '@trpc/server/adapters/next';

type TRPCRequestInfo = {
  calls: Array<{
    getRawInput: () => Promise<unknown>;
  }>;
};

export async function createContext(opts: trpcNext.CreateNextContextOptions) {
  const { info } = opts as trpcNext.CreateNextContextOptions & {
    info: TRPCRequestInfo;
  };
  const rawInput = await info.calls[0].getRawInput();

  return {
    req: opts.req,
    res: opts.res,
    rawInput,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
