import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Define the schema for our application.
// The `tasks` table holds the user's task items, each tied to a specific
// `runId` so concurrent test runs stay isolated from one another.
export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    status: v.union(v.literal("todo"), v.literal("done")),
    runId: v.string(),
  }).index("by_run_id_and_status", ["runId", "status"]),
});
