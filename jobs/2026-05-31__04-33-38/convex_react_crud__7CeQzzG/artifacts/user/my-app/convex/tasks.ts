import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    runId: v.string(),
    status: v.optional(v.union(v.literal("todo"), v.literal("done"))),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("tasks").withIndex("by_run_id_and_status", (q) => q.eq("runId", args.runId));
    if (args.status) {
      q = q.filter((q) => q.eq(q.field("status"), args.status));
      // Note: Convex indexes work best with equality on the first fields. 
      // Since we have ["runId", "status"], we could use:
      // q = ctx.db.query("tasks").withIndex("by_run_id_and_status", (q) => q.eq("runId", args.runId).eq("status", args.status));
      // Let's use that for efficiency if status is provided.
    }
    
    if (args.status) {
        return await ctx.db
            .query("tasks")
            .withIndex("by_run_id_and_status", (q) => 
                q.eq("runId", args.runId).eq("status", args.status)
            )
            .collect();
    }

    return await ctx.db
      .query("tasks")
      .withIndex("by_run_id_and_status", (q) => q.eq("runId", args.runId))
      .collect();
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
