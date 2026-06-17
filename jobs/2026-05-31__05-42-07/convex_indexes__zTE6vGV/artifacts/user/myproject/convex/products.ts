import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const seed = mutation({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("products", {
      runId: args.runId,
      name: "Cheap TV",
      category: "Electronics",
      price: 500,
      inStock: true,
    });
    await ctx.db.insert("products", {
      runId: args.runId,
      name: "Expensive TV",
      category: "Electronics",
      price: 1500,
      inStock: true,
    });
  },
});

export const getByCategory = query({
  args: { runId: v.string(), category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_runId_and_category", (q) =>
        q.eq("runId", args.runId).eq("category", args.category)
      )
      .collect();
  },
});

export const getCheapByCategory = query({
  args: { runId: v.string(), category: v.string(), maxPrice: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_runId_category_price", (q) =>
        q.eq("runId", args.runId).eq("category", args.category).lte("price", args.maxPrice)
      )
      .collect();
  },
});
