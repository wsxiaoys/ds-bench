import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  generations: defineTable({
    prompt: v.string(),
    result: v.string(),
  }),
});
