import { v } from "convex/values";
import { mutation, query } from "convex/server";

export const list = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .order("desc")
      .collect();
  },
});

export const add = mutation({
  args: { text: v.string(), runId: v.string() },
  handler: async (ctx, args) => {
    const trimmed = args.text.trim();
    if (!trimmed) {
      throw new Error("Task text is required.");
    }
    return await ctx.db.insert("tasks", {
      text: trimmed,
      isCompleted: false,
      runId: args.runId,
    });
  },
});

export const toggle = mutation({
  args: { id: v.id("tasks"), runId: v.string() },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("Task not found.");
    }
    if (task.runId !== args.runId) {
      throw new Error("Task runId mismatch.");
    }
    await ctx.db.patch(args.id, { isCompleted: !task.isCompleted });
  },
});

export const remove = mutation({
  args: { id: v.id("tasks"), runId: v.string() },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) {
      return;
    }
    if (task.runId !== args.runId) {
      throw new Error("Task runId mismatch.");
    }
    await ctx.db.delete(args.id);
  },
});
