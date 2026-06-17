import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products_zr_m4oqgcu: defineTable({
    name: v.string(),
    price: v.number(),
    inStock: v.boolean(),
  }),
});
