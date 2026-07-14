import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * A single-row table that holds the running total of likes.
 * The count is stored as a non-null integer starting at 0; if no row
 * exists yet we treat that as 0 in our read path.
 */
export const likes = sqliteTable("likes", {
  id: integer("id").primaryKey(),
  count: integer("count").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(""),
});
