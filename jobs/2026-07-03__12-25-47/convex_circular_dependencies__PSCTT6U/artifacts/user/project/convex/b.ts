import { query } from "./_generated/server";
import { anyApi } from "convex/server";

export const funcB = query({
  args: {},
  handler: async (ctx: any) => {
    return ctx.runQuery(anyApi.c.funcC);
  },
});
