import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// `list` returns all tasks for a particular runId. It optionally filters by
// status by leveraging the `by_run_id_and_status` index when a status is
// supplied. When the status filter is omitted it falls back to a query against
// the runId index (which is REDACTEDmatically created by Convex as `.index("by_..."`).
export const list = query({
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

// `add` inserts a new task for the supplied runId. The task defaults to the
// "todo" status on creation.
export const add = mutation({
  args: {
    runId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmed = args.text.trim();
    if (trimmed.length === 0) {
      throw new Error("Task text cannot be empty");
    }

    const taskId = await ctx.db.insert("tasks", {
      runId: args.runId,
      text: trimmed,
      status: "todo",
    });
    return taskId;
  },
});

// `updateStatus` toggles the status of a single task between "todo" and "done".
export const updateStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(v.literal("todo"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

// `remove` deletes a single task by id.
export const remove = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
