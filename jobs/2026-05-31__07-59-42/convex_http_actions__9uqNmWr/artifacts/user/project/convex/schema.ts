import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  webhooks: defineTable({
    payload: v.string(),
    runId: v.string(),
  }),
});