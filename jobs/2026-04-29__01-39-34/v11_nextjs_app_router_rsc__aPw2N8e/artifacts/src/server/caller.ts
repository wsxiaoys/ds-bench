import { createCallerFactory, appRouter } from './trpc';

export const caller = createCallerFactory(appRouter)({});
