import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products_zrv5kd8ivs: defineTable({
    name: v.string(),
    price: v.number(),
    inStock: v.boolean(),
  }),
});
