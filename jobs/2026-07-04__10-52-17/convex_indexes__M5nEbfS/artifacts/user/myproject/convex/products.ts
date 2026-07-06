import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Seed the products table with sample data for a given runId.
 * Inserts a variety of products across categories, including at least
 * two Electronics products with prices 500 and 1500.
 */
export const seed = mutation({
  args: {
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const products = [
      {
        runId: args.runId,
        name: "Budget Headphones",
        category: "Electronics",
        price: 500,
        inStock: true,
      },
      {
        runId: args.runId,
        name: "Premium Laptop",
        category: "Electronics",
        price: 1500,
        inStock: true,
      },
      {
        runId: args.runId,
        name: "Wireless Mouse",
        category: "Electronics",
        price: 25,
        inStock: true,
      },
      {
        runId: args.runId,
        name: "Mechanical Keyboard",
        category: "Electronics",
        price: 120,
        inStock: false,
      },
      {
        runId: args.runId,
        name: "Coffee Mug",
        category: "Kitchen",
        price: 15,
        inStock: true,
      },
      {
        runId: args.runId,
        name: "Stand Mixer",
        category: "Kitchen",
        price: 350,
        inStock: true,
      },
      {
        runId: args.runId,
        name: "Running Shoes",
        category: "Apparel",
        price: 90,
        inStock: true,
      },
      {
        runId: args.runId,
        name: "Winter Jacket",
        category: "Apparel",
        price: 200,
        inStock: false,
      },
    ];

    const ids = [];
    for (const product of products) {
      const id = await ctx.db.insert("products", product);
      ids.push(id);
    }
    return ids;
  },
});

/**
 * Return all products for a given runId and category using the
 * by_runId_and_category index.
 */
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

/**
 * Return products for a given runId and category with a price less than
 * or equal to maxPrice using the by_runId_category_price index.
 */
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