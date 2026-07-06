import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    text: v.optional(v.string()),
    isCompleted: v.optional(v.boolean()),
    runId: v.optional(v.string()),
  }).index("by_runId", ["runId"]),
});
