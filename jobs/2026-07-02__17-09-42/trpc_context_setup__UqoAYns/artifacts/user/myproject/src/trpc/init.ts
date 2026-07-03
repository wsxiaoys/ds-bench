import { initTRPC } from '@trpc/server';

/**
 * Context shape provided to every procedure. The `userId` is extracted
 * from the `x-user-id` header by `createContext` in the App Router route.
 */
export interface Context {
  userId: string;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;