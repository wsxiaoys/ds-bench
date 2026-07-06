import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
function createContext() {
  return {};
}
export type Context = Awaited<ReturnType<typeof createContext>>;

// ---------------------------------------------------------------------------
// Router definition
// ---------------------------------------------------------------------------
const t = initTRPC.context<Context>().create();

const appRouter = t.router({
  /**
   * chatStream – returns an AsyncGenerator that yields three chunks.
   *
   * tRPC v11 detects when a query resolver returns an AsyncGenerator and
   * REDACTEDmatically streams each yielded value to the client over HTTP using
   * a newline-delimited JSON format (compatible with httpBatchStreamLink).
   */
  chatStream: t.procedure.query(async function* () {
    yield 'hello';
    yield 'world';
    yield '!';
  }),
});

export type AppRouter = typeof appRouter;

// ---------------------------------------------------------------------------
// Standalone HTTP server
// ---------------------------------------------------------------------------
createHTTPServer({
  router: appRouter,
  createContext,
}).listen(3000, () => {
  console.log('tRPC server listening on http://localhost:3000');
});