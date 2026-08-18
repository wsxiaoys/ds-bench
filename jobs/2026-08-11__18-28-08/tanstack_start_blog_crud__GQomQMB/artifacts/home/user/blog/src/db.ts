import Database from 'better-sqlite3';
import { join } from 'path';

// Resolve database path
const dbPath = join(process.cwd(), 'blog.db');

const db = new Database(dbPath);

// Initialize table
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    body TEXT NOT NULL,
    tags TEXT NOT NULL, -- JSON array of strings
    published INTEGER NOT NULL -- 1 for true, 0 for false
  )
`);

export interface Post {
  id: number;
  title: string;
  slug: string;
  body: string;
  tags: string[]; // parsed from JSON
  published: boolean;
}

export function getPosts(): Post[] {
  const rows = db.prepare('SELECT * FROM posts ORDER BY id DESC').all() as any[];
  return rows.map(row => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    body: row.body,
    tags: JSON.parse(row.tags),
    published: row.published === 1,
  }));
}

export function getPublishedPosts(): Post[] {
  const rows = db.prepare('SELECT * FROM posts WHERE published = 1 ORDER BY id DESC').all() as any[];
  return rows.map(row => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    body: row.body,
    tags: JSON.parse(row.tags),
    published: true,
  }));
}

export function getPostBySlug(slug: string): Post | null {
  const row = db.prepare('SELECT * FROM posts WHERE slug = ?').get(slug) as any;
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    body: row.body,
    tags: JSON.parse(row.tags),
    published: row.published === 1,
  };
}

export function deletePost(slug: string): void {
  db.prepare('DELETE FROM posts WHERE slug = ?').run(slug);
}

export function isSlugUnique(slug: string, excludeId?: number): boolean {
  if (excludeId !== undefined) {
    const row = db.prepare('SELECT COUNT(*) as count FROM posts WHERE slug = ? AND id != ?').get(slug, excludeId) as any;
    return row.count === 0;
  } else {
    const row = db.prepare('SELECT COUNT(*) as count FROM posts WHERE slug = ?').get(slug) as any;
    return row.count === 0;
  }
}

export function createPost(post: Omit<Post, 'id' | 'slug'>): Post {
  const tagsJson = JSON.stringify(post.tags);
  const publishedVal = post.published ? 1 : 0;

  // Generate unique slug
  const slug = generateSlug(post.title, (s) => isSlugUnique(s));

  const result = db.prepare(
    'INSERT INTO posts (title, slug, body, tags, published) VALUES (?, ?, ?, ?, ?)'
  ).run(post.title, slug, post.body, tagsJson, publishedVal);

  return {
    id: result.lastInsertRowid as number,
    title: post.title,
    slug,
    body: post.body,
    tags: post.tags,
    published: post.published,
  };
}

export function updatePost(id: number, post: Omit<Post, 'id' | 'slug'> & { slug?: string }): void {
  const tagsJson = JSON.stringify(post.tags);
  const publishedVal = post.published ? 1 : 0;

  // If a slug is already provided and we want to keep it, or we need to generate a new slug because the title changed.
  // Let's check:
  const currentPost = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as any;
  if (!currentPost) {
    throw new Error(`Post with id ${id} not found`);
  }

  let finalSlug = currentPost.slug;
  if (post.title !== currentPost.title) {
    finalSlug = generateSlug(post.title, (s) => isSlugUnique(s, id));
  }

  db.prepare(
    'UPDATE posts SET title = ?, slug = ?, body = ?, tags = ?, published = ? WHERE id = ?'
  ).run(post.title, finalSlug, post.body, tagsJson, publishedVal, id);
}

// Helper for slug generation
export function generateSlug(title: string, isUniqueCheck: (slug: string) => boolean): string {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!baseSlug) {
    baseSlug = 'post';
  }

  if (isUniqueCheck(baseSlug)) {
    return baseSlug;
  }

  let n = 2;
  while (true) {
    const candidate = `${baseSlug}-${n}`;
    if (isUniqueCheck(candidate)) {
      return candidate;
    }
    n++;
  }
}
