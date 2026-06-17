import { initTRPC } from "@trpc/server";
import { createNodeHttpServer } from "@trpc/server-adapters/node-http";

const t = initTRPC.create();

const appRouter = t.router({
  countdown: t.procedure
    .input((val): val is number => typeof val === "number")
    .subscription(async function* ({ input }) {
      let count = input;
      while (count >= 0) {
        yield count;
        count--;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }),
});

export type AppRouter = typeof appRouter;

const server = createNodeHttpServer({
  router: appRouter,
  createContext: () => ({}),
});

server.listen(3000, () => {
  console.log("tRPC server listening on port 3000");
});