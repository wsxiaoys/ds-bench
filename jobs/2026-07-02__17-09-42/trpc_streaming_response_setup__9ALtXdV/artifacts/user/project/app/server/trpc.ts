import { initTRPC } from "@trpc/server";
import superjson from "superjson";

/**
 * Context for tRPC procedures. Kept minimal for this demo.
 */
export const createTRPCContext = async () => {
  return {};
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Initialization of tRPC backend.
 *
 * `superjson` is used as the transformer so that dates, maps,
 * sets, etc. survive the network round-trip. It must match the
 * transformer used on the client.
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;