import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products_zrla228408: defineTable({
    name: v.string(),
    price: v.number(),
    inStock: v.boolean(),
  }),
});