import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";
import { appRouter } from "@/server/root";
import { createTRPCContext } from "@/server/trpc";

/**
 * tRPC fetch handler. We support both `GET` (queries) and `POST`
 * (mutations, including the `uploadFile` FormData mutation).
 *
 * tRPC v11 natively understands `FormData` payloads when sent from the
 * client, so we don't need any extra body-parsing configuration here.
 */
const createContext = async (req: NextRequest) =>
  createTRPCContext({ headers: req.headers });

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError({ path, error }) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error(
          `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
        );
      }
    },
  });

export { handler as GET, handler as POST };