import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks_zrl7zyfwrl: defineTable({
    title: v.string(),
    isCompleted: v.boolean(),
  }),
});
