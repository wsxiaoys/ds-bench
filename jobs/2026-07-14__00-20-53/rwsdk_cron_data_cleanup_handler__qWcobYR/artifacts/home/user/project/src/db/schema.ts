import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Records table: short-lived records that may expire.
 *
 * `expiresAt` is a Unix timestamp in **milliseconds** (D1 integer column).
 * A record is considered expired when its `expiresAt` is `<= Date.now()`.
 */
export const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export type Record = typeof records.$inferSelect;
export type NewRecord = typeof records.$inferInsert;
