import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

export const insert = mutation({
  args: {
    text: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("messages", {
      text: args.text,
      runId: args.runId,
    });
  },
});

export const list = query({
  args: {
    runId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("runId"), args.runId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
