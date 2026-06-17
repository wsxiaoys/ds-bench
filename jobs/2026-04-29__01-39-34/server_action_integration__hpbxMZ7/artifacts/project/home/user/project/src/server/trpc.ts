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
        text: z.string(),
      })
    )
    .mutation(({ input }) => ({
      success: true,
      message: input.text,
    })),
});

export type AppRouter = typeof appRouter;

export const createCallerFactory = t.createCallerFactory;
