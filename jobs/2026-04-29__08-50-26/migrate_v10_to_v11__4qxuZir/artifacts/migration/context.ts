import { inferAsyncReturnType } from '@trpc/server';
import * as trpcNext from '@trpc/server/adapters/next';

export async function createContext({
  req,
  res,
  info,
}: trpcNext.CreateNextContextOptions) {
  // Access raw input before procedure execution
  const rawInput = info.calls[0]?.getRawInput();

  return {
    req,
    res,
    rawInput,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
