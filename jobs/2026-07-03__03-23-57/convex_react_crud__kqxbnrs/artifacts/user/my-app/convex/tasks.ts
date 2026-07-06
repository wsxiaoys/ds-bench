import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Fetch all tasks for a specific runId, optionally filtered by status
export const get = query({
  args: {
    runId: v.string(),
    status: v.optional(v.union(v.literal("todo"), v.literal("done"))),
  },
  handler: async (ctx, args) => {
    const status = args.status;
    if (status !== undefined) {
      return await ctx.db
        .query("tasks")
        .withIndex("by_run_id_and_status", (q) =>
          q.eq("runId", args.runId).eq("status", status)
        )
        .collect();
    }
    return await ctx.db
      .query("tasks")
      .withIndex("by_run_id_and_status", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

// Add a new task (defaults to "todo" and sets the runId)
export const add = mutation({
  args: {
    text: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks", {
      text: args.text,
      status: "todo",
      runId: args.runId,
    });
    return taskId;
  },
});

// Update a task's status
export const updateStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(v.literal("todo"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

// Delete a task
export const deleteTask = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
