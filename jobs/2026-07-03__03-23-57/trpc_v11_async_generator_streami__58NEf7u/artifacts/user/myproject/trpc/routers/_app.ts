import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '../init';

export const appRouter = createTRPCRouter({
  chatStream: baseProcedure
    .input(z.string())
    .query(async function* (opts) {
      const text = opts.input;
      
      yield `[Start] Initiating stream for input: "${text}"\n`;
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      yield `[Step 1/3] Parsing search context and extracting semantics...\n`;
      await new Promise((resolve) => setTimeout(resolve, 400));
      
      yield `[Step 2/3] Generating relevant insights via AI model...\n`;
      await new Promise((resolve) => setTimeout(resolve, 400));
      
      yield `[Step 3/3] Formatting streamed response:\n\n`;
      await new Promise((resolve) => setTimeout(resolve, 200));

      const responseTokens = [
        "Hello! ", "This ", "is ", "a ", "simulated ", "real-time ", "response ",
        "streamed ", "directly ", "from ", "the ", "tRPC ", "v11 ", "backend ",
        "using ", "AsyncGenerator ", "and ", "httpBatchStreamLink.\n\n",
        "tRPC v11 makes streaming queries extremely simple and robust. ",
        "You don't need WebSockets or complex Server-Sent Events setup. ",
        "Standard HTTP chunked transfer encoding handles everything seamlessly!\n\n",
        "Hope this helps with your project! 🚀"
      ];

      for (const token of responseTokens) {
        yield token;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      yield `\n\n[End] Stream completed successfully.`;
    }),
});

export type AppRouter = typeof appRouter;
