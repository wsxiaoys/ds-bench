import { sqliteTable, integer } from "drizzle-orm/sqlite-core";

export const likes = sqliteTable("likes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
});
