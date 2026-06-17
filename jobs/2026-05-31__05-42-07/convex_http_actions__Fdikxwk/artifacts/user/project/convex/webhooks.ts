import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const get_webhook = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("webhooks")
      .filter((q) => q.eq(q.field("runId"), args.runId))
      .collect();
  },
});

export const insert = internalMutation({
  args: { payload: v.string(), runId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhooks", {
      payload: args.payload,
      runId: args.runId,
    });
  },
});
