import { initTRPC, TRPCError } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

// 1. Implement createContext
export function createContext({ req }: any) {
  const authorization = req.headers.authorization;
  const user =
    authorization === 'Bearer mysecrettoken'
      ? { id: 1, name: 'Admin' }
      : null;

  return { user };
}

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

// 2. Create isAuthed middleware
const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

// 3. Create protectedProcedure
const protectedProcedure = t.procedure.use(isAuthed);

// 4. Create router
export const appRouter = t.router({
  secretData: protectedProcedure.query(() => {
    return { secret: 'super secret' };
  }),
});

export type AppRouter = typeof appRouter;

// Start server
createHTTPServer({
  router: appRouter,
  createContext,
}).listen(3000);

console.log('Server listening on http://localhost:3000');
