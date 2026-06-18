import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const insert = mutation({
  args: { text: v.string(), runId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      text: args.text,
      runId: args.runId,
    });
  },
});

export const list = query({
  args: { runId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});