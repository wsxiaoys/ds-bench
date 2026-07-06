import { query } from "./_generated/server";
import { api } from "./_generated/api";

export const funcA = query({
  args: {},
  handler: async (ctx: any) => {
    return ctx.runQuery(api.b.funcB);
  },
});
