import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks_zrc1qtsh9c: defineTable({
    title: v.string(),
    isCompleted: v.boolean(),
  }),
});
