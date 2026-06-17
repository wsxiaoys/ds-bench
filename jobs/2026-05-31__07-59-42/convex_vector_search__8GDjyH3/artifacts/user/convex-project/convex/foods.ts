import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";

export const insert = mutation({
  args: {
    runId: v.string(),
    text: v.string(),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("foods", {
      text: args.text,
      runId: args.runId,
      embedding: args.embedding,
    });
    return id;
  },
});

export const searchSimilar = action({
  args: {
    runId: v.string(),
    vector: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.vectorSearch("foods", "by_embedding", {
      vector: args.vector,
      limit: 2,
      filter: (q) => q.eq("runId", args.runId),
    });
    return results;
  },
});