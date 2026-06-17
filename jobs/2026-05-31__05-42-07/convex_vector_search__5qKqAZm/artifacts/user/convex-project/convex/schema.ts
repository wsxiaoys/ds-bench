import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  foods: defineTable({
    text: v.string(),
    runId: v.string(),
    embedding: v.array(v.float64()),
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 3,
    filterFields: ["runId"],
  }),
});
