import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getTasksByRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

export const createTask = mutation({
  args: {
    text: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", {
      text: args.text,
      isCompleted: false,
      runId: args.runId,
    });
  },
});

export const toggleTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (task) {
      await ctx.db.patch(args.id, { isCompleted: !task.isCompleted });
    }
  },
});

export const deleteTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});