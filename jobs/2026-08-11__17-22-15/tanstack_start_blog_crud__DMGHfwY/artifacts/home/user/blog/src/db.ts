import Database from 'better-sqlite3';
import path from 'path';
import { parseTags } from './utils';

// Resolve the db path to /home/user/blog/blog.db
const dbPath = path.resolve('/home/user/blog/blog.db');

const db = new Database(dbPath);

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    body TEXT NOT NULL,
    tags TEXT NOT NULL, -- JSON array of strings
    published INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export interface Post {
  id: number;
  title: string;
  slug: string;
  body: string;
  tags: string[];
  published: boolean;
  created_at: string;
}

export { parseTags };

export function getAllPosts(): Post[] {
  const rows = db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all() as any[];
  return rows.map(row => ({
    ...row,
    tags: JSON.parse(row.tags),
    published: row.published === 1
  }));
}

export function getPublishedPosts(tag?: string): Post[] {
  let rows: any[];
  if (tag) {
    rows = db.prepare(`
      SELECT * FROM posts 
      WHERE published = 1 AND EXISTS (
        SELECT 1 FROM json_each(posts.tags) WHERE value = ?
      )
      ORDER BY created_at DESC
    `).all(tag) as any[];
  } else {
    rows = db.prepare('SELECT * FROM posts WHERE published = 1 ORDER BY created_at DESC').all() as any[];
  }
  return rows.map(row => ({
    ...row,
    tags: JSON.parse(row.tags),
    published: row.published === 1
  }));
}

export function getPostBySlug(slug: string): Post | null {
  const row = db.prepare('SELECT * FROM posts WHERE slug = ?').get(slug) as any;
  if (!row) return null;
  return {
    ...row,
    tags: JSON.parse(row.tags),
    published: row.published === 1
  };
}

export function generateUniqueSlug(title: string, excludePostId?: number): string {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!baseSlug) {
    baseSlug = 'post';
  }

  let slug = baseSlug;
  let n = 2;
  while (true) {
    const query = excludePostId
      ? 'SELECT id FROM posts WHERE slug = ? AND id != ?'
      : 'SELECT id FROM posts WHERE slug = ?';
    const params = excludePostId ? [slug, excludePostId] : [slug];
    const existing = db.prepare(query).get(...params);
    if (!existing) {
      return slug;
    }
    slug = `${baseSlug}-${n}`;
    n++;
  }
}

export function createPost(title: string, body: string, tags: string[], published: boolean): Post {
  const slug = generateUniqueSlug(title);
  const tagsJson = JSON.stringify(tags);
  const publishedVal = published ? 1 : 0;

  const result = db.prepare(`
    INSERT INTO posts (title, slug, body, tags, published)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, slug, body, tagsJson, publishedVal);

  const id = result.lastInsertRowid as number;
  return {
    id,
    title,
    slug,
    body,
    tags,
    published,
    created_at: new Date().toISOString()
  };
}

export function updatePost(id: number, title: string, body: string, tags: string[], published: boolean): void {
  const slug = generateUniqueSlug(title, id);
  const tagsJson = JSON.stringify(tags);
  const publishedVal = published ? 1 : 0;

  db.prepare(`
    UPDATE posts
    SET title = ?, slug = ?, body = ?, tags = ?, published = ?
    WHERE id = ?
  `).run(title, slug, body, tagsJson, publishedVal, id);
}

export function deletePostBySlug(slug: string): void {
  db.prepare('DELETE FROM posts WHERE slug = ?').run(slug);
}
