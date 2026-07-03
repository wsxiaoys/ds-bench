import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Fetch the counter for the given runId.
export const getCounter = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .first();
    return counter ?? null;
  },
});

// Increment the counter for the given runId, creating it if it doesn't exist.
export const increment = mutation({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const existing = await ctx.db
      .query("counters")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { count: existing.count + 1 });
      return existing.count + 1;
    }
    const newId = await ctx.db.insert("counters", { runId, count: 1 });
    return 1;
  },
});