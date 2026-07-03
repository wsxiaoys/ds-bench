import { publicProcedure } from "../trpc";

/**
 * Chat router. Exposes streaming procedures that yield chunks of data.
 */
export const chatRouter = {
  /**
   * Stream a sequence of words to the client, one at a time,
   * separated by a small delay so the client can render them
   * as they arrive.
   */
  streamWords: publicProcedure.query(async function* () {
    const words = ["Hello", "streaming", "world"];

    for (const word of words) {
      // Small artificial delay to simulate streaming.
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield word;
    }
  }),
};