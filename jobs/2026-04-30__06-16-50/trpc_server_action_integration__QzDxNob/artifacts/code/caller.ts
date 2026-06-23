import { appRouter, createCallerFactory } from "@/server/trpc";

/**
 * Create a server-side caller for the app router.
 *
 * Uses `createCallerFactory` from the tRPC instance to create
 * a caller that can invoke procedures directly from the server
 * (e.g., in Server Actions) without going over HTTP.
 */
const createCaller = createCallerFactory(appRouter);

export { createCaller };