import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const insert = mutation({
  args: {
    text: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      text: args.text,
      runId: args.runId,
    });
    return messageId;
  },
});

export const list = query({
  args: {
    runId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("runId"), args.runId))
      .order("desc")
      .paginate(args.paginationOpts);
    return results;
  },
});