import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.optional(v.boolean()),
    runId: v.string(),
    status: v.optional(v.string()),
  }).index("by_runId", ["runId"]),
});
