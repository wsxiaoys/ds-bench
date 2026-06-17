import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const counter = await ctx.db
      .query("counters")
      .filter((q) => q.eq(q.field("runId"), args.runId))
      .first();
    return counter ? counter.count : 0;
  },
});

export const increment = mutation({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const counter = await ctx.db
      .query("counters")
      .filter((q) => q.eq(q.field("runId"), args.runId))
      .first();
    if (counter) {
      await ctx.db.patch(counter._id, { count: counter.count + 1 });
    } else {
      await ctx.db.insert("counters", { runId: args.runId, count: 1 });
    }
  },
});
