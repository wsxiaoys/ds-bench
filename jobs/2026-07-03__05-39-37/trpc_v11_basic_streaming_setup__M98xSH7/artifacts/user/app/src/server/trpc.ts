import { initTRPC } from "@trpc/server";

export function createTRPCContext() {
  return {};
}

const t = initTRPC.create({
  server: {},
});

export const router = t.router;
export const procedure = t.procedure;