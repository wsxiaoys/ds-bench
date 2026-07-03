import { z } from 'zod';
import { publicProcedure, router } from './trpc';

/**
 * A simple mock streaming response that yields chunks of text
 * one token at a time, simulating a slow LLM response.
 */
async function* generateChatStream(prompt: string) {
  const reply = `Hello! You said: "${prompt}". Here is a streamed response from the tRPC v11 server.`;
  const tokens = reply.split(/(\s+)/);

  for (const token of tokens) {
    // Simulate network/compute latency between tokens
    await new Promise((resolve) => setTimeout(resolve, 80));
    yield token;
  }

  yield '\n\n[done]';
}

export const appRouter = router({
  healthcheck: publicProcedure.query(() => 'ok'),

  chatStream: publicProcedure
    .input(z.object({ prompt: z.string() }))
    .subscription(async function* ({ input }) {
      for await (const chunk of generateChatStream(input.prompt)) {
        yield chunk;
      }
    }),
});

export type AppRouter = typeof appRouter;