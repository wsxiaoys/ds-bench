import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'blog.db');
export const db = new Database(dbPath);

// Create table if not exists
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

export interface Post {
  id: number;
  slug: string;
  title: string;
  content: string;
  published: number;
  created_at: string;
}

export function getPublishedPosts(): Post[] {
  return db.prepare('SELECT * FROM posts WHERE published = 1 ORDER BY created_at DESC').all() as Post[];
}

export function getAllPosts(): Post[] {
  return db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all() as Post[];
}

export function getPostBySlug(slug: string): Post | undefined {
  return db.prepare('SELECT * FROM posts WHERE slug = ?').get(slug) as Post | undefined;
}

export function createPost(post: { slug: string; title: string; content: string; published: number; created_at: string }) {
  const stmt = db.prepare(`
    INSERT INTO posts (slug, title, content, published, created_at)
    VALUES (@slug, @title, @content, @published, @created_at)
  `);
  return stmt.run(post);
}

export function updatePost(oldSlug: string, post: { slug: string; title: string; content: string; published: number }) {
  const stmt = db.prepare(`
    UPDATE posts
    SET slug = @slug, title = @title, content = @content, published = @published
    WHERE slug = @oldSlug
  `);
  return stmt.run({ ...post, oldSlug });
}

export function deletePost(slug: string) {
  const stmt = db.prepare('DELETE FROM posts WHERE slug = ?');
  return stmt.run(slug);
}
