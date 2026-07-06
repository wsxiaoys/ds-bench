import { createCallerFactory, appRouter } from './trpc';

// Create a server-side caller using createCallerFactory.
// createCallerFactory(appRouter) returns a function that takes context;
// calling it with {} produces the caller object with procedure methods.
export const caller = createCallerFactory(appRouter)({});