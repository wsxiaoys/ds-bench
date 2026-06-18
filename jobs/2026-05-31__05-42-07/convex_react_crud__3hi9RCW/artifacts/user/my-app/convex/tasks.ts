import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {
    runId: v.string(),
    status: v.optional(v.union(v.literal("todo"), v.literal("done"))),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("tasks")
        .withIndex("by_run_id_and_status", (q) =>
          q.eq("runId", args.runId).eq("status", args.status!)
        )
        .collect();
    } else {
      return await ctx.db
        .query("tasks")
        .withIndex("by_run_id_and_status", (q) => q.eq("runId", args.runId))
        .collect();
    }
  },
});

export const add = mutation({
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

export const updateStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(v.literal("todo"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const remove = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
