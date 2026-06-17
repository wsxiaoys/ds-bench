import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products_zr_wdfd3p7: defineTable({
    name: v.string(),
    price: v.number(),
    inStock: v.boolean(),
  }),
});
