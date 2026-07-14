import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Blog posts table.
 *
 * Each post is identified by a unique `slug` which is used as the URL segment
 * on the dynamic route `/blog/:slug`.
 */
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;