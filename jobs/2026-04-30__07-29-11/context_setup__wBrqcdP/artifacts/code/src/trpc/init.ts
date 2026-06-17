import { initTRPC } from '@trpc/server';

type Context = {
  userId: string;
};

const t = initTRPC.context<Context>().create();

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export type { Context };
