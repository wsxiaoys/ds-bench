import { query } from "./_generated/server";
import { api } from "./_generated/api";

export const funcB = query({
  args: {},
  handler: async (ctx: any) => {
    return ctx.runQuery(api.c.funcC);
  },
});
