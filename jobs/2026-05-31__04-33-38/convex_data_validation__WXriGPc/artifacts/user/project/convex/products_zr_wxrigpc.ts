import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    price: v.number(),
    inStock: v.boolean(),
  },
  handler: async (ctx, args) => {
    const productId = await ctx.db.insert("products_zr_wxrigpc", {
      name: args.name,
      price: args.price,
      inStock: args.inStock,
    });
    return productId;
  },
});
