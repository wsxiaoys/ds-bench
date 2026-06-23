import { initTRPC } from '@trpc/server';

export interface Context {
  userId: string;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
