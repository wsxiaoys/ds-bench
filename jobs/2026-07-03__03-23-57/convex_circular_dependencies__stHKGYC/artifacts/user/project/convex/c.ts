import { query } from "./_generated/server";
import { api } from "./_generated/api";

export const funcC = query({
  args: {},
  handler: async (ctx: any) => {
    return ctx.runQuery(api.a.funcA);
  },
});
