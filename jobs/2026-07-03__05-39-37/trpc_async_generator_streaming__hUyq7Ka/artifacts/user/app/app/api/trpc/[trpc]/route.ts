import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/app";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
    // Allow streamed responses (AsyncGenerator) to flush incrementally.
    responseMeta: () => ({
      headers: {
        "x-trpc-streaming": "1",
      },
    }),
  });

export { handler as GET, handler as POST };