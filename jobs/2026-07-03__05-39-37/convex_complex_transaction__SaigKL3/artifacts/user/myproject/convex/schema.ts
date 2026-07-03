import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Schema for the bank application.
// The `accounts` table stores a per-user balance. The `name` field is
// indexed so that looking up an account by name is efficient and so the
// transfer / getBalance functions can find accounts quickly.
export default defineSchema({
  accounts: defineTable({
    name: v.string(),
    balance: v.number(),
  }).index("by_name", ["name"]),
});