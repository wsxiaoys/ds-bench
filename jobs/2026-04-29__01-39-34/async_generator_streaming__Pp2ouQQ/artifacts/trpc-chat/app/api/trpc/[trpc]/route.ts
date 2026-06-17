import { fetchRequestHandler } from "@trpc/server/next";
import { appRouter } from "@/server/routers/app";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };
