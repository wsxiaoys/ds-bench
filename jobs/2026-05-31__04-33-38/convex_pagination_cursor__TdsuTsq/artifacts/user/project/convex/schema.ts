import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    text: v.string(),
    runId: v.string(),
  }).index("by_runId", ["runId"]),
});
