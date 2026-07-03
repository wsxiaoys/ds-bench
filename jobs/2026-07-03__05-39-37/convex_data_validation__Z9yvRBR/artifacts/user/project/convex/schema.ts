import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products_zrhlx96b5s: defineTable({
    name: v.string(),
    price: v.number(),
    inStock: v.boolean(),
  }),
});