import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'posts.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for reliability
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    body TEXT NOT NULL,
    published INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS post_tags (
    post_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY (post_id, tag),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
  CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag);
`);

export interface Post {
  id: number;
  title: string;
  slug: string;
  body: string;
  published: number; // 0 or 1
  tags: string[];
}

export function generateSlug(title: string, excludePostId?: number): string {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  if (!baseSlug) {
    baseSlug = 'post';
  }

  let slug = baseSlug;
  let counter = 2;
  while (true) {
    const row = excludePostId 
      ? db.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?').get(slug, excludePostId)
      : db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug);
    
    if (!row) {
      return slug;
    }
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export function getPublishedPosts(tag?: string): Post[] {
  let posts: any[];
  if (tag) {
    posts = db.prepare(`
      SELECT p.* FROM posts p
      JOIN post_tags pt ON p.id = pt.post_id
      WHERE p.published = 1 AND pt.tag = ?
    `).all(tag);
  } else {
    posts = db.prepare('SELECT * FROM posts WHERE published = 1').all();
  }

  return posts.map(post => {
    const tagsRows = db.prepare('SELECT tag FROM post_tags WHERE post_id = ?').all(post.id) as { tag: string }[];
    return {
      ...post,
      tags: tagsRows.map(r => r.tag)
    };
  });
}

export function getAllPosts(): Post[] {
  const posts = db.prepare('SELECT * FROM posts').all() as any[];
  return posts.map(post => {
    const tagsRows = db.prepare('SELECT tag FROM post_tags WHERE post_id = ?').all(post.id) as { tag: string }[];
    return {
      ...post,
      tags: tagsRows.map(r => r.tag)
    };
  });
}

export function getPostBySlug(slug: string): Post | null {
  const post = db.prepare('SELECT * FROM posts WHERE slug = ?').get(slug) as any;
  if (!post) return null;
  const tagsRows = db.prepare('SELECT tag FROM post_tags WHERE post_id = ?').all(post.id) as { tag: string }[];
  return {
    ...post,
    tags: tagsRows.map(r => r.tag)
  };
}

export function createPost(data: { title: string; body: string; tags: string[]; published: number }): Post {
  const slug = generateSlug(data.title);
  
  const insertPost = db.prepare(`
    INSERT INTO posts (title, slug, body, published)
    VALUES (?, ?, ?, ?)
  `);
  
  const insertTag = db.prepare(`
    INSERT OR IGNORE INTO post_tags (post_id, tag)
    VALUES (?, ?)
  `);

  let postId: number | bigint = 0;
  const runTx = db.transaction(() => {
    const result = insertPost.run(data.title, slug, data.body, data.published);
    postId = result.lastInsertRowid;
    for (const tag of data.tags) {
      insertTag.run(postId, tag);
    }
  });
  runTx();

  return {
    id: Number(postId),
    title: data.title,
    slug,
    body: data.body,
    published: data.published,
    tags: data.tags
  };
}

export function updatePost(currentSlug: string, data: { title: string; body: string; tags: string[]; published: number }): Post | null {
  const post = db.prepare('SELECT id FROM posts WHERE slug = ?').get(currentSlug) as { id: number } | undefined;
  if (!post) return null;

  const newSlug = generateSlug(data.title, post.id);

  const updatePostStmt = db.prepare(`
    UPDATE posts
    SET title = ?, slug = ?, body = ?, published = ?
    WHERE id = ?
  `);

  const deleteTags = db.prepare('DELETE FROM post_tags WHERE post_id = ?');
  const insertTag = db.prepare(`
    INSERT OR IGNORE INTO post_tags (post_id, tag)
    VALUES (?, ?)
  `);

  const runTx = db.transaction(() => {
    updatePostStmt.run(data.title, newSlug, data.body, data.published, post.id);
    deleteTags.run(post.id);
    for (const tag of data.tags) {
      insertTag.run(post.id, tag);
    }
  });
  runTx();

  return {
    id: post.id,
    title: data.title,
    slug: newSlug,
    body: data.body,
    published: data.published,
    tags: data.tags
  };
}

export function deletePost(slug: string): boolean {
  const result = db.prepare('DELETE FROM posts WHERE slug = ?').run(slug);
  return result.changes > 0;
}
