import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    status: v.union(v.literal("todo"), v.literal("done")),
    runId: v.string(),
  }).index("by_run_id_and_status", ["runId", "status"]),
});