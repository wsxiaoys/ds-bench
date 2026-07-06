import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const insert = mutation({
  args: {
    runId: v.string(),
    text: v.string(),
    embedding: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const id: Id<"foods"> = await ctx.db.insert("foods", {
      runId: args.runId,
      text: args.text,
      embedding: args.embedding,
    });
    return id;
  },
});

export const searchSimilar = action({
  args: {
    runId: v.string(),
    vector: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.vectorSearch("foods", "by_embedding", {
      vector: args.vector,
      limit: 2,
      filter: (q) => q.eq("runId", args.runId),
    });
    return results.map((r) => ({ _id: r._id, _score: r._score }));
  },
});
