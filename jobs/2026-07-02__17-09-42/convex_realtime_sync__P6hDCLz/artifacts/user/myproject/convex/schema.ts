import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Define the schema for the collaborative counter application.
// The counters table is keyed by runId so each run/session has its own counter.
export default defineSchema({
  counters: defineTable({
    runId: v.string(),
    count: v.number(),
  }).index("by_runId", ["runId"]),
});