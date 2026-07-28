import { createServerFn } from '@tanstack/react-start'
import { getDb, generateSlug, parseTags } from './db'

export const getPublishedPosts = createServerFn({ method: 'GET' })
  .validator((tag: string | undefined) => tag)
  .handler(async ({ data: tag }) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM posts WHERE published = 1 ORDER BY id DESC').all();
    const posts = rows.map((row: any) => ({
      ...row,
      tags: JSON.parse(row.tags) as string[]
    }));
    if (tag) {
      return posts.filter((p: any) => p.tags.includes(tag));
    }
    return posts;
  });

export const getPostBySlug = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM posts WHERE slug = ?').get(slug);
    if (!row) return null;
    return {
      ...row,
      tags: JSON.parse(row.tags) as string[]
    };
  });

export const getAllPosts = createServerFn({ method: 'GET' })
  .handler(async () => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM posts ORDER BY id DESC').all();
    return rows.map((row: any) => ({
      ...row,
      tags: JSON.parse(row.tags) as string[]
    }));
  });

export const createPost = createServerFn({ method: 'POST' })
  .validator((post: { title: string; body: string; tags: string; published: boolean }) => post)
  .handler(async ({ data: post }) => {
    const db = getDb();
    const slug = generateSlug(post.title);
    const tagsArr = parseTags(post.tags);
    const stmt = db.prepare(`
      INSERT INTO posts (title, slug, body, published, tags)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(post.title, slug, post.body, post.published ? 1 : 0, JSON.stringify(tagsArr));
    return { success: true, slug };
  });

export const updatePost = createServerFn({ method: 'POST' })
  .validator((data: { id: number; title: string; body: string; tags: string; published: boolean }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    const slug = generateSlug(data.title, data.id);
    const tagsArr = parseTags(data.tags);
    const stmt = db.prepare(`
      UPDATE posts
      SET title = ?, slug = ?, body = ?, published = ?, tags = ?
      WHERE id = ?
    `);
    stmt.run(data.title, slug, data.body, data.published ? 1 : 0, JSON.stringify(tagsArr), data.id);
    return { success: true, slug };
  });

export const deletePost = createServerFn({ method: 'POST' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM posts WHERE slug = ?');
    stmt.run(slug);
    return { success: true };
  });
