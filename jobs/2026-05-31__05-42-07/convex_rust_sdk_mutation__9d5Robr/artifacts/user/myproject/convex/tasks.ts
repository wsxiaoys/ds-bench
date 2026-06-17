import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { text: v.string(), runId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", { text: args.text, runId: args.runId });
  },
});
