import { initTRPC } from "@trpc/server";

/**
 * This is the context that is passed to the tRPC procedures.
 * It is created per-request by the `createContext` function in the
 * Next.js App Router API route.
 */
export interface Context {
  userId: string;
}

const t = initTRPC.context<Context>().create();

/**
 * The base tRPC router, pre-configured with our context type.
 */
export const router = t.router;
export const procedure = t.procedure;