import { z } from "zod";
import { publicProcedure, router } from "../trpc";

// Simulated word bank that mimics an LLM streaming response
const SAMPLE_RESPONSES: Record<string, string> = {
  default:
    "Hello! I am a simulated streaming AI assistant built with tRPC v11 and AsyncGenerator. " +
    "This response is being streamed word by word over a standard HTTP connection using " +
    "httpBatchStreamLink. Each chunk arrives independently, demonstrating real-time streaming " +
    "without WebSockets. tRPC v11 natively supports AsyncGenerator procedures, making it easy " +
    "to build streaming LLM applications with end-to-end type safety.",
  hello:
    "Hi there! Great to meet you. I am streaming this greeting back to you chunk by chunk " +
    "using tRPC v11 AsyncGenerator support over HTTP.",
  trpc:
    "tRPC v11 introduces first-class support for AsyncGenerators, enabling streaming responses " +
    "over plain HTTP. Combined with httpBatchStreamLink on the client, you get fully type-safe " +
    "streaming with zero boilerplate.",
};

/**
 * Main application router
 */
export const appRouter = router({
  /**
   * chatStream: takes a string message and streams back a response
   * word-by-word using an AsyncGenerator.
   */
  chatStream: publicProcedure
    .input(z.string().min(1).max(500))
    .query(async function* ({ input }): AsyncGenerator<string> {
      const lowerInput = input.toLowerCase().trim();

      // Pick a response based on keywords in the input
      let fullResponse = SAMPLE_RESPONSES.default;
      for (const [key, value] of Object.entries(SAMPLE_RESPONSES)) {
        if (key !== "default" && lowerInput.includes(key)) {
          fullResponse = value;
          break;
        }
      }

      const words = fullResponse.split(" ");

      // Stream each word with a realistic delay to simulate LLM token output
      for (const word of words) {
        yield word + " ";
        // Randomize delay between 40ms–120ms for a natural feel
        await new Promise((resolve) =>
          setTimeout(resolve, 40 + Math.random() * 80)
        );
      }
    }),
});

// Export type router type signature — used by the client
export type AppRouter = typeof appRouter;
