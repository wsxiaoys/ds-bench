import { createCallerFactory, appRouter } from './trpc';

const createCaller = createCallerFactory(appRouter);
export const caller = createCaller({});
