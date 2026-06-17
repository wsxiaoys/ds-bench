import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const insert = mutation({
  args: {
    body: v.string(),
    author: v.string(),
    channelId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      body: args.body,
      author: args.author,
      channelId: args.channelId,
    });
  },
});

export const search = query({
  args: {
    query: v.string(),
    channelId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withSearchIndex("search_body", (q) =>
        q.search("body", args.query).eq("channelId", args.channelId)
      )
      .paginate(args.paginationOpts);
  },
});
