import { z } from 'zod';
import { router, publicProcedure } from './trpc';

async function* generateChatStream(prompt: string) {
  const response = `This is a streamed response to: "${prompt}". Here is more content being streamed chunk by chunk.`;
  const words = response.split(' ');

  for (const word of words) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    yield word + ' ';
  }

  yield '\n[DONE]';
}

export const appRouter = router({
  chatStream: publicProcedure
    .input(z.string())
    .subscription(async function* ({ input }) {
      for await (const chunk of generateChatStream(input)) {
        yield chunk;
      }
    }),
});

export type AppRouter = typeof appRouter;
