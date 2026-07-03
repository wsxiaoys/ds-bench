import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Insert sample products for a given runId.
export const seed = mutation({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const products = [
      {
        runId,
        name: "Budget Headphones",
        category: "Electronics",
        price: 500,
        inStock: true,
      },
      {
        runId,
        name: "Premium Laptop",
        category: "Electronics",
        price: 1500,
        inStock: true,
      },
      {
        runId,
        name: "Cotton T-Shirt",
        category: "Clothing",
        price: 25,
        inStock: true,
      },
      {
        runId,
        name: "Wireless Mouse",
        category: "Electronics",
        price: 40,
        inStock: false,
      },
      {
        runId,
        name: "Coffee Maker",
        category: "Home",
        price: 80,
        inStock: true,
      },
    ];

    for (const product of products) {
      await ctx.db.insert(product);
    }
  },
});

// Return all products for a given runId and category using the
// by_runId_and_category index.
export const getByCategory = query({
  args: { runId: v.string(), category: v.string() },
  handler: async (ctx, { runId, category }) => {
    return await ctx.db
      .query("products")
      .withIndex("by_runId_and_category", (q) =>
        q.eq("runId", runId).eq("category", category),
      )
      .collect();
  },
});

// Return products for a given runId and category with price <= maxPrice
// using the by_runId_category_price index.
export const getCheapByCategory = query({
  args: {
    runId: v.string(),
    category: v.string(),
    maxPrice: v.number(),
  },
  handler: async (ctx, { runId, category, maxPrice }) => {
    return await ctx.db
      .query("products")
      .withIndex("by_runId_category_price", (q) =>
        q.eq("runId", runId).eq("category", category).lte("price", maxPrice),
      )
      .collect();
  },
});