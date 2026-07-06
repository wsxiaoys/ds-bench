import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Mutation: products:seed
// Inserts sample products for the given runId, including at least one
// 'Electronics' product with price 500 and another with price 1500.
export const seed = mutation({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const products = [
      {
        runId: args.runId,
        name: "Budget Phone",
        category: "Electronics",
        price: 500,
        inStock: true,
      },
      {
        runId: args.runId,
        name: "Premium Phone",
        category: "Electronics",
        price: 1500,
        inStock: true,
      },
      {
        runId: args.runId,
        name: "Cotton Shirt",
        category: "Clothing",
        price: 30,
        inStock: true,
      },
      {
        runId: args.runId,
        name: "Wool Coat",
        category: "Clothing",
        price: 200,
        inStock: false,
      },
      {
        runId: args.runId,
        name: "Python Book",
        category: "Books",
        price: 45,
        inStock: true,
      },
    ];

    for (const product of products) {
      await ctx.db.insert("products", product);
    }
  },
});

// Query: products:getByCategory
// Returns all products for a given runId and category using the
// by_runId_and_category index.
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

// Query: products:getCheapByCategory
// Returns products for a given runId and category with price <= maxPrice
// using the by_runId_category_price index.
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