import { initTRPC } from '@trpc/server';
import { NextRequest } from 'next/server';

export type Context = {
  req?: NextRequest;
};

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;