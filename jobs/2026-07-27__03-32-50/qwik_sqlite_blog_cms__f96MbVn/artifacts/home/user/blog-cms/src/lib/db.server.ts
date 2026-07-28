import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * This module must only ever be imported from `routeLoader$` / `routeAction$`
 * callbacks (or other server-only code). Keeping all SQLite access here, and
 * only reaching it from server boundaries, ensures the Qwik optimizer never
 * needs to include `better-sqlite3` (or any SQL) in the client bundle.
 */

export interface Post {
  id: number;
  slug: string;
  title: string;
  content: string;
  published: number;
  created_at: string;
}

export interface PostInput {
  slug: string;
  title: string;
  content: string;
  published: boolean;
}

export type MutationResult =
  | { success: true }
  | { success: false; error: string };

let dbInstance: Database.Database | undefined;

function getDb(): Database.Database {
  if (!dbInstance) {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, "blog.db");
    dbInstance = new Database(dbPath);
    dbInstance.pragma("journal_mode = WAL");
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        published INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `);
  }
  return dbInstance;
}

export function listPublishedPosts(): Post[] {
  return getDb()
    .prepare("SELECT * FROM posts WHERE published = 1 ORDER BY created_at DESC")
    .all() as Post[];
}

export function listAllPosts(): Post[] {
  return getDb()
    .prepare("SELECT * FROM posts ORDER BY created_at DESC")
    .all() as Post[];
}

export function getPostBySlug(slug: string): Post | undefined {
  return getDb()
    .prepare("SELECT * FROM posts WHERE slug = ?")
    .get(slug) as Post | undefined;
}

function slugExists(slug: string): boolean {
  return (
    getDb().prepare("SELECT 1 FROM posts WHERE slug = ?").get(slug) !==
    undefined
  );
}

export function createPost(input: PostInput): MutationResult {
  if (slugExists(input.slug)) {
    return {
      success: false,
      error: `A post with the slug "${input.slug}" already exists.`,
    };
  }
  const createdAt = new Date().toISOString();
  getDb()
    .prepare(
      "INSERT INTO posts (slug, title, content, published, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      input.slug,
      input.title,
      input.content,
      input.published ? 1 : 0,
      createdAt,
    );
  return { success: true };
}

export function updatePost(
  originalSlug: string,
  input: PostInput,
): MutationResult {
  if (input.slug !== originalSlug && slugExists(input.slug)) {
    return {
      success: false,
      error: `A post with the slug "${input.slug}" already exists.`,
    };
  }
  const result = getDb()
    .prepare(
      "UPDATE posts SET slug = ?, title = ?, content = ?, published = ? WHERE slug = ?",
    )
    .run(
      input.slug,
      input.title,
      input.content,
      input.published ? 1 : 0,
      originalSlug,
    );
  if (result.changes === 0) {
    return { success: false, error: "Post not found." };
  }
  return { success: true };
}

export function deletePost(slug: string): MutationResult {
  const result = getDb().prepare("DELETE FROM posts WHERE slug = ?").run(slug);
  if (result.changes === 0) {
    return { success: false, error: "Post not found." };
  }
  return { success: true };
}
