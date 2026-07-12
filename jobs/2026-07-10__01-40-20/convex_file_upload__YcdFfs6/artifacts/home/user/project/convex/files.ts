import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Generate a one-time upload URL for the client to POST a file to Convex storage.
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

// Persist a reference to an uploaded file in the `files` table.
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

// Return all files belonging to a given run, each augmented with its download URL.
export const listFiles = query({
  args: {
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("files")
      .filter((q) => q.eq(q.field("runId"), args.runId))
      .collect();

    return await Promise.all(
      files.map(async (file) => ({
        _id: file._id,
        title: file.title,
        url: await ctx.storage.getUrl(file.storageId),
      })),
    );
  },
});