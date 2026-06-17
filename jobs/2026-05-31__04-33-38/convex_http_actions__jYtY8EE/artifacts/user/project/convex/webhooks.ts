import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert_webhook = mutation({
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
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("webhooks")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();
  },
});
