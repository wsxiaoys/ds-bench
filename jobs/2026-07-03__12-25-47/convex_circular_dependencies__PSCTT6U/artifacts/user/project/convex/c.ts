import { query } from "./_generated/server";
import { anyApi } from "convex/server";

export const funcC = query({
  args: {},
  handler: async (ctx: any) => {
    return ctx.runQuery(anyApi.a.funcA);
  },
});
