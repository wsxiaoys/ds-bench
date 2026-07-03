import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const counters = await ctx.db
      .query("counters")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();
    if (counters.length === 0) return null;
    return counters[0];
  },
});

export const increment = mutation({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const counters = await ctx.db
      .query("counters")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();
    if (counters.length === 0) {
      await ctx.db.insert("counters", { runId: args.runId, count: 1 });
    } else {
      const counter = counters[0];
      await ctx.db.patch(counter._id, { count: counter.count + 1 });
    }
  },
});
