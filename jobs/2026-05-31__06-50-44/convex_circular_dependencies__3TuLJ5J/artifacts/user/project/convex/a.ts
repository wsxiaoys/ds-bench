import { query } from "./_generated/server";
import { anyApi } from "convex/server";

const api = anyApi;

export const funcA = query({
  args: {},
  handler: async (ctx: any) => {
    return ctx.runQuery(api.b.funcB);
  },
});
