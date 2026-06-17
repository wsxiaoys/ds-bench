import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const seed = mutation({
  args: {
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const runId = args.runId;

    await ctx.db.insert("products", {
      runId,
      name: "Budget Laptop",
      category: "Electronics",
      price: 500,
      inStock: true,
    });

    await ctx.db.insert("products", {
      runId,
      name: "Premium Laptop",
      category: "Electronics",
      price: 1500,
      inStock: true,
    });

    await ctx.db.insert("products", {
      runId,
      name: "Cotton T-Shirt",
      category: "Clothing",
      price: 25,
      inStock: true,
    });

    await ctx.db.insert("products", {
      runId,
      name: "Coffee Mug",
      category: "Home",
      price: 15,
      inStock: false,
    });
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
        q.eq("runId", args.runId).eq("category", args.category)
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
          .lte("price", args.maxPrice)
      )
      .collect();
  },
});