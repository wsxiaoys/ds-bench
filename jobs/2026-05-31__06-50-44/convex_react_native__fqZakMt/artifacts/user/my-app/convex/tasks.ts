import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("tasks")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

export const addTask = mutation({
  args: { text: v.string(), runId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db.insert("tasks", {
      text: args.text,
      isCompleted: false,
      runId: args.runId,
    });
  },
});
