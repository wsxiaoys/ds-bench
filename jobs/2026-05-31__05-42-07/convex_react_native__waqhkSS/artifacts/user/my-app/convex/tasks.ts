import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getTasks = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("runId"), args.runId))
      .collect();
  },
});

export const addTask = mutation({
  args: { text: v.string(), runId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", {
      text: args.text,
      isCompleted: false,
      runId: args.runId,
    });
  },
});
