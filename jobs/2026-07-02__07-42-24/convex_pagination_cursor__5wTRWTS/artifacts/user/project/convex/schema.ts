import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    text: v.optional(v.string()),
    runId: v.string(),
    author: v.optional(v.string()),
    body: v.optional(v.string()),
  }).index("by_runId", ["runId"]),
});
