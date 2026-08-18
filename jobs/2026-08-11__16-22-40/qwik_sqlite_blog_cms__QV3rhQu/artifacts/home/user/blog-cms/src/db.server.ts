import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

export interface Post {
  id?: number;
  slug: string;
  title: string;
  content: string;
  published: number; // 0 or 1
  created_at: string;
}

const dbDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "blog.db");
export const db = new Database(dbPath);

// Create the table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )
`);

export function getAllPosts(): Post[] {
  return db.prepare("SELECT * FROM posts ORDER BY created_at DESC").all() as Post[];
}

export function getPublishedPosts(): Post[] {
  return db.prepare("SELECT * FROM posts WHERE published = 1 ORDER BY created_at DESC").all() as Post[];
}

export function getPostBySlug(slug: string): Post | undefined {
  return db.prepare("SELECT * FROM posts WHERE slug = ?").get(slug) as Post | undefined;
}

export function createPost(post: { slug: string; title: string; content: string; published: number }): void {
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO posts (slug, title, content, published, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(post.slug, post.title, post.content, post.published, createdAt);
}

export function updatePostBySlug(
  oldSlug: string,
  post: { slug: string; title: string; content: string; published: number }
): void {
  db.prepare(
    "UPDATE posts SET slug = ?, title = ?, content = ?, published = ? WHERE slug = ?"
  ).run(post.slug, post.title, post.content, post.published, oldSlug);
}

export function deletePostBySlug(slug: string): void {
  db.prepare("DELETE FROM posts WHERE slug = ?").run(slug);
}
