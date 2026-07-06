import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks_zrpy82jd8t: defineTable({
    title: v.string(),
    isCompleted: v.boolean(),
  }),
});
