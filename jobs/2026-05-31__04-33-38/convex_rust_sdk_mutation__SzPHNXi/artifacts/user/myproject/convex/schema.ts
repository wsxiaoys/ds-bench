import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    runId: v.optional(v.string()),
    status: v.optional(v.string()),
  }),
});
