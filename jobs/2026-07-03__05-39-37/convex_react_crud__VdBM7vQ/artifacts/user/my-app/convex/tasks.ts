import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Fetch all tasks for a specific `runId`, optionally filtered by `status`.
 *
 * Uses the `by_run_id_and_status` index so the query stays efficient regardless
 * of how many tasks exist across other runs.
 */
export const getTasks = query({
  args: {
    runId: v.string(),
    status: v.optional(v.union(v.literal("todo"), v.literal("done"))),
  },
  handler: async (ctx, args) => {
    if (args.status !== undefined) {
      return await ctx.db
        .query("tasks")
        .withIndex("by_run_id_and_status", (q) =>
          q.eq("runId", args.runId).eq("status", args.status!),
        )
        .collect();
    }
    return await ctx.db
      .query("tasks")
      .withIndex("by_run_id_and_status", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

/**
 * Add a new task. It defaults to the "todo" status and is scoped to the given
 * `runId` so it is isolated from other concurrent runs.
 */
export const addTask = mutation({
  args: {
    text: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", {
      text: args.text,
      status: "todo",
      runId: args.runId,
    });
  },
});

/**
 * Toggle a task's status between "todo" and "done".
 */
export const toggleTask = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (task === null) {
      return;
    }
    await ctx.db.patch(args.id, {
      status: task.status === "todo" ? "done" : "todo",
    });
  },
});

/**
 * Update a task's status to an explicit value.
 */
export const updateTaskStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(v.literal("todo"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

/**
 * Delete a task by its document id.
 */
export const deleteTask = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});