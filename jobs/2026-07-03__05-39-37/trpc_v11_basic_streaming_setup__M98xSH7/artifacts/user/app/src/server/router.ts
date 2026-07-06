import { router, procedure } from "./trpc";

async function* streamNumbers(): AsyncGenerator<number, void, unknown> {
  for (const n of [1, 2, 3]) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    yield n;
  }
}

export const appRouter = router({
  streamNumbers: procedure.query(async function* () {
    yield* streamNumbers();
  }),
});

export type AppRouter = typeof appRouter;