import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveFile = mutation({
  args: {
    storageId: v.id("_storage"),
    title: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("files", {
      storageId: args.storageId,
      title: args.title,
      runId: args.runId,
    });
  },
});

export const listFiles = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("files")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();

    return Promise.all(
      files.map(async (file) => ({
        title: file.title,
        url: await ctx.storage.getUrl(file.storageId),
      }))
    );
  },
});
