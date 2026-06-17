import { query } from "./_generated/server";
import { anyApi } from "convex/server";

export const funcA = query({
  args: {},
  handler: async (ctx: any) => {
    return ctx.runQuery(anyApi.b.funcB);
  },
});