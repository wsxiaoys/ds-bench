import { initTRPC } from "@trpc/server";
import { NextRequest } from "next/server";

export const createContext = async (req: NextRequest) => {
  return {};
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;