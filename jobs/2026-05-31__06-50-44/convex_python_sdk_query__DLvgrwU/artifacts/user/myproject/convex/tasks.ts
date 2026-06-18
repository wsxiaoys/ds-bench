import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const add = mutation({
  args: {
    text: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks", {
      text: args.text,
      status: args.status,
    });

    return taskId;
  },
});

export const get = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("tasks").collect();
  },
});
