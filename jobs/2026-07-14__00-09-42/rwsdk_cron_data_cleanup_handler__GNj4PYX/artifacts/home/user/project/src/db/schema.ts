import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export type Record = typeof records.$inferSelect;
export type NewRecord = typeof records.$inferInsert;
