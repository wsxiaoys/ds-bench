import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const seed = mutation({
  args: {
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const products = [
      {
        runId: args.runId,
        name: "Smartphone",
        category: "Electronics",
        price: 500,
        inStock: true,
      },
      {
        runId: args.runId,
        name: "Gaming Laptop",
        category: "Electronics",
        price: 1500,
        inStock: false,
      },
      {
        runId: args.runId,
        name: "Office Chair",
        category: "Furniture",
        price: 200,
        inStock: true,
      },
    ];

    for (const product of products) {
      await ctx.db.insert("products", product);
    }
  },
});

export const getByCategory = query({
  args: {
    runId: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("products")
      .withIndex("by_runId_and_category", (q) =>
        q.eq("runId", args.runId).eq("category", args.category),
      )
      .collect();
  },
});

export const getCheapByCategory = query({
  args: {
    runId: v.string(),
    category: v.string(),
    maxPrice: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("products")
      .withIndex("by_runId_category_price", (q) =>
        q
          .eq("runId", args.runId)
          .eq("category", args.category)
          .lte("price", args.maxPrice),
      )
      .collect();
  },
});
