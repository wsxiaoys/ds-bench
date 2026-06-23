import { z } from "zod";

import { publicProcedure, router } from "@/server/trpc";

export const appRouter = router({
  hello: publicProcedure.input(z.string()).query(({ input }) => {
    return `Hello ${input}`;
  }),
});

export type AppRouter = typeof appRouter;
