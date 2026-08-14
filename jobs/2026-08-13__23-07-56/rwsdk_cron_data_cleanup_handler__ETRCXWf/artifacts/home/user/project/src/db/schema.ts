import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const records = sqliteTable("records", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  label: text("label").notNull(),
  expiresAt: integer("expiresAt").notNull(),
});
