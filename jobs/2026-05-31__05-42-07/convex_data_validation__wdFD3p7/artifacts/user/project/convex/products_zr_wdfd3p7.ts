import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    price: v.number(),
    inStock: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("products_zr_wdfd3p7", {
      name: args.name,
      price: args.price,
      inStock: args.inStock,
    });
  },
});
