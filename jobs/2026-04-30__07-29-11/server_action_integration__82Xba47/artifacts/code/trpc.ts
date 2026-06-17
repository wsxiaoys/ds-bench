import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

const t = initTRPC.create({
  transformer: superjson,
});

export const appRouter = t.router({
  addMessage: t.procedure
    .input(
      z.object({
        text: z.string().min(1, "Message text is required."),
      }),
    )
    .mutation(({ input }) => {
      return {
        success: true as const,
        message: input.text,
      };
    }),
});

export type AppRouter = typeof appRouter;

const createCaller = t.createCallerFactory(appRouter);

export const appRouterCaller = createCaller({});
