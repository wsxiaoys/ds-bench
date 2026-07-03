import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

// Insert a new food document with an embedding.
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

// Search for the most similar foods using vector search.
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