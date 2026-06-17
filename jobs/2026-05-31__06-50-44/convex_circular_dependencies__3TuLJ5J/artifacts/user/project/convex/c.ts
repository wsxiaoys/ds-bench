import { query } from "./_generated/server";
import { anyApi } from "convex/server";

const api = anyApi;

export const funcC = query({
  args: {},
  handler: async (ctx: any) => {
    return ctx.runQuery(api.a.funcA);
  },
});
