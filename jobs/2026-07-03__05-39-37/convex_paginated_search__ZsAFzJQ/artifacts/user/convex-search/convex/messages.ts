import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Temporary mutation to clear all messages (used for schema migration)
export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("messages").collect();
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return docs.length;
  },
});