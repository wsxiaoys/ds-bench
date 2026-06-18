import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

// Helper to simulate streaming chunks (e.g., LLM tokens) with a small delay.
async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const appRouter = router({
  /**
   * chatStream
   * Takes a string `prompt` and returns an AsyncGenerator that yields
   * text chunks over time. tRPC v11's `httpBatchStreamLink` will stream
   * each yielded value to the client as soon as it is produced.
   */
  chatStream: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
      }),
    )
    .query(async function* ({ input }) {
      // Build a deterministic "response" derived from the prompt so the
      // demo feels like a real chat completion stream.
      const response =
        `You said: "${input.prompt}". ` +
        `Here is a streamed reply demonstrating tRPC v11 async generators ` +
        `with httpBatchStreamLink. Each word arrives as its own chunk.`;

      const tokens = response.split(' ');
      for (const token of tokens) {
        await delay(120);
        yield token + ' ';
      }
    }),
});

export type AppRouter = typeof appRouter;
