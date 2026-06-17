import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .first();
    return counter;
  },
});

export const increment = mutation({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .first();
    if (counter) {
      await ctx.db.patch(counter._id, { count: counter.count + 1 });
      return counter.count + 1;
    } else {
      const id = await ctx.db.insert("counters", {
        runId: args.runId,
        count: 1,
      });
      return 1;
    }
  },
});