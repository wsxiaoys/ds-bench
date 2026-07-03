import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const insertWebhook = internalMutation({
  args: {
    payload: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("webhooks", {
      payload: args.payload,
      runId: args.runId,
    });
    return id;
  },
});

export const get_webhook = query({
  args: {
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("webhooks")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();
  },
});
