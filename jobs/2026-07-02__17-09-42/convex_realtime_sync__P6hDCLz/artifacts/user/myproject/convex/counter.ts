import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Query the counter for a given runId.
// Returns the count value (or 0 if no counter exists yet for this runId).
export const getCount = query({
  args: {
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .first();

    return counter?.count ?? 0;
  },
});

// Increment the counter for a given runId.
// If the counter doesn't exist yet, create it starting at 1.
export const increment = mutation({
  args: {
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .first();

    if (counter === null) {
      await ctx.db.insert("counters", { runId: args.runId, count: 1 });
      return 1;
    }

    const newCount = counter.count + 1;
    await ctx.db.patch(counter._id, { count: newCount });
    return newCount;
  },
});