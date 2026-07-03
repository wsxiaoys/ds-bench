import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const seed = mutation({
  args: {
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const sampleProducts = [
      {
        runId: args.runId,
        name: "Laptop",
        category: "Electronics",
        price: 500,
        inStock: true,
      },
      {
        runId: args.runId,
        name: "Smartphone",
        category: "Electronics",
        price: 1500,
        inStock: true,
      },
      {
        runId: args.runId,
        name: "Headphones",
        category: "Electronics",
        price: 200,
        inStock: true,
      },
      {
        runId: args.runId,
        name: "Coffee Maker",
        category: "Appliances",
        price: 100,
        inStock: false,
      },
      {
        runId: args.runId,
        name: "Blender",
        category: "Appliances",
        price: 80,
        inStock: true,
      },
    ];

    for (const product of sampleProducts) {
      await ctx.db.insert("products", product);
    }

    return sampleProducts.length;
  },
});

export const getByCategory = query({
  args: {
    runId: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
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
    return await ctx.db
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