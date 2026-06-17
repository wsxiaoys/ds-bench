import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products: defineTable({
    runId: v.string(),
    name: v.string(),
    category: v.string(),
    price: v.number(),
    inStock: v.boolean(),
  })
    .index("by_runId_and_category", ["runId", "category"])
    .index("by_runId_category_price", ["runId", "category", "price"]),
});