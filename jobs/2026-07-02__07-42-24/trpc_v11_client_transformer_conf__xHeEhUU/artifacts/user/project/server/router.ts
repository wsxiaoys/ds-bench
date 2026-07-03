import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

const t = initTRPC.create({
  transformer: superjson,
});

export const appRouter = t.router({
  getServerTime: t.procedure.query(() => {
    return new Date('2026-04-28T10:00:00.000Z');
  }),
});

export type AppRouter = typeof appRouter;
