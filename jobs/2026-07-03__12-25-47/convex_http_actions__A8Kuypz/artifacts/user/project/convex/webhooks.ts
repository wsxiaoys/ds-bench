import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

export const insertWebhook = internalMutation({
  args: {
    payload: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhooks", {
      payload: args.payload,
      runId: args.runId,
    });
  },
});

export const get_webhook = query({
  args: {
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();
    return webhooks;
  },
});
