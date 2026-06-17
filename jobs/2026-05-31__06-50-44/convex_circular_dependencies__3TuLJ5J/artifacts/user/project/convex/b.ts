import { query } from "./_generated/server";
import { anyApi } from "convex/server";

const api = anyApi;

export const funcB = query({
  args: {},
  handler: async (ctx: any) => {
    return ctx.runQuery(api.c.funcC);
  },
});
