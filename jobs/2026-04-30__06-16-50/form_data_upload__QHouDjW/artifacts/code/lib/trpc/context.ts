import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export async function createContext(opts: FetchCreateContextFnOptions) {
  return {
    // You can add request headers, auth, etc. here
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;