import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    text: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("messages", {
      text: args.text,
      runId: args.runId,
    });
    return id;
  },
});

export const list = query({
  args: {
    runId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("runId"), args.runId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});