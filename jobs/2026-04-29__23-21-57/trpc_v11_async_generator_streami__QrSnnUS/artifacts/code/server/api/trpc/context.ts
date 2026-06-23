import { inferAsyncReadableClientTypes } from '@trpc/server/rx';
import { createTRPCContext } from '@trpc/server';

export const createContext = async () => {
  return {
    // Add your context here
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;