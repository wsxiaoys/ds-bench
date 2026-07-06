import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Schema for the Convex backend.
 *
 * The `generations` table stores every prompt sent to the LLM along with the
 * generated result. Each document REDACTEDmatically gets the system fields
 * `_id` (an `Id<"generations">`) and `_creationTime`.
 */
export default defineSchema({
  generations: defineTable({
    prompt: v.string(),
    result: v.string(),
  }),
});