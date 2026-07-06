import { initTRPC } from '@trpc/server';

export const createContext = async (req: Request) => {
  const userId = req.headers.get('x-user-id') ?? 'anonymous';
  return { userId };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
