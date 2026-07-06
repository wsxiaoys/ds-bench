import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Schema for the Task Manager app.
 *
 * The `tasks` table stores individual to-do items. Each task is scoped to a
 * `runId` so that concurrent test runs never collide with one another.
 */
export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    status: v.union(v.literal("todo"), v.literal("done")),
    runId: v.string(),
  }).index("by_run_id_and_status", ["runId", "status"]),
});