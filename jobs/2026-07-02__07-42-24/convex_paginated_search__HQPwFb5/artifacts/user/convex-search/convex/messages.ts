import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const insert = mutation({
  args: {
    body: v.string(),
    author: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("messages", {
      body: args.body,
      author: args.author,
      runId: args.runId,
    });
    return id;
  },
});

export const search = query({
  args: {
    query: v.string(),
    runId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withSearchIndex("search_body", (q) =>
        q.search("body", args.query).eq("runId", args.runId)
      )
      .paginate(args.paginationOpts);
  },
});
