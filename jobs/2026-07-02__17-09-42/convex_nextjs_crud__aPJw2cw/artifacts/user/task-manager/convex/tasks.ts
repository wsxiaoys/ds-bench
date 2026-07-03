import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// List all tasks for the given runId.
export const list = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

// Add a new task for the given runId.
export const add = mutation({
  args: {
    text: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmed = args.text.trim();
    if (trimmed.length === 0) {
      throw new Error("Task text cannot be empty");
    }
    const taskId = await ctx.db.insert("tasks", {
      text: trimmed,
      isCompleted: false,
      runId: args.runId,
    });
    return taskId;
  },
});

// Toggle the isCompleted status of a task.
export const toggle = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("Task not found");
    }
    await ctx.db.patch(args.id, { isCompleted: !task.isCompleted });
  },
});

// Delete a task.
export const remove = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});