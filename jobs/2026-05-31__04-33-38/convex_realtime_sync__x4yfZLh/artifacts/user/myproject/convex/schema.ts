import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  counters: defineTable({
    runId: v.string(),
    count: v.number(),
  }).index("by_runId", ["runId"]),
});
