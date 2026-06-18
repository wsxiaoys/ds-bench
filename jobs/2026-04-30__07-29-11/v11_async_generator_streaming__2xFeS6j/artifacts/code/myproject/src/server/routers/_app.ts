import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "../trpc";

async function* generateChatChunks(prompt: string): AsyncGenerator<string> {
  const normalizedPrompt = prompt.trim() || "Tell me something about tRPC streaming.";
  const parts = [
    `You said: ${normalizedPrompt}`,
    "Streaming over standard HTTP works with AsyncGenerator responses.",
    "Each yielded chunk arrives progressively in the browser.",
    "This pattern is a good fit for LLM tokens or long-running tasks.",
  ];

  for (const part of parts) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    yield `${part} `;
  }
}

export const appRouter = createTRPCRouter({
  chatStream: publicProcedure
    .input(z.object({ prompt: z.string().min(1) }))
    .query(async function* ({ input }) {
      yield* generateChatChunks(input.prompt);
    }),
});

export type AppRouter = typeof appRouter;
