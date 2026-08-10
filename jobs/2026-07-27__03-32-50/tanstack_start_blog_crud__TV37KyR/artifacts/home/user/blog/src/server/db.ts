import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

export interface Post {
  id: number
  title: string
  slug: string
  body: string
  tags: Array<string>
  published: boolean
  createdAt: string
  updatedAt: string
}

interface PostRow {
  id: number
  title: string
  slug: string
  body: string
  tags: string
  published: number
  created_at: string
  updated_at: string
}

function rowToPost(row: PostRow): Post {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    body: row.body,
    tags: row.tags ? (JSON.parse(row.tags) as Array<string>) : [],
    published: !!row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const globalStore = globalThis as unknown as { __blogDb?: DatabaseSync }

function getDb(): DatabaseSync {
  if (!globalStore.__blogDb) {
    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    const db = new DatabaseSync(path.join(dataDir, 'blog.sqlite'))
    db.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        body TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        published INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)
    globalStore.__blogDb = db
  }
  return globalStore.__blogDb
}

/**
 * Derives a URL slug from a title: lowercases, replaces every run of
 * non [a-z0-9] characters with a single `-`, and trims leading/trailing `-`.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Splits a comma-separated tags string into a trimmed, non-empty list.
 */
export function parseTags(input: string): Array<string> {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

function slugTakenBy(db: DatabaseSync, slug: string): number | undefined {
  const row = db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug) as
    | { id: number }
    | undefined
  return row?.id
}

function generateUniqueSlug(
  db: DatabaseSync,
  title: string,
  excludeId?: number,
): string {
  const base = slugify(title) || 'post'
  let candidate = base
  let n = 2
  for (;;) {
    const ownerId = slugTakenBy(db, candidate)
    if (ownerId === undefined || ownerId === excludeId) return candidate
    candidate = `${base}-${n}`
    n += 1
  }
}

export function listAllPosts(): Array<Post> {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM posts ORDER BY datetime(created_at) DESC, id DESC')
    .all() as Array<PostRow>
  return rows.map(rowToPost)
}

export function listPublishedPosts(tag?: string): Array<Post> {
  const posts = listAllPosts().filter((p) => p.published)
  if (tag) return posts.filter((p) => p.tags.includes(tag))
  return posts
}

export function getPostBySlug(slug: string): Post | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM posts WHERE slug = ?').get(slug) as
    | PostRow
    | undefined
  return row ? rowToPost(row) : undefined
}

export function getPublishedPostBySlug(slug: string): Post | undefined {
  const post = getPostBySlug(slug)
  return post && post.published ? post : undefined
}

export interface PostInput {
  title: string
  body: string
  tags: Array<string>
  published: boolean
}

export function createPost(input: PostInput): Post {
  const db = getDb()
  const slug = generateUniqueSlug(db, input.title)
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO posts (title, slug, body, tags, published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.title,
    slug,
    input.body,
    JSON.stringify(input.tags),
    input.published ? 1 : 0,
    now,
    now,
  )
  return getPostBySlug(slug)!
}

export function updatePost(
  currentSlug: string,
  input: PostInput,
): Post | undefined {
  const db = getDb()
  const existing = getPostBySlug(currentSlug)
  if (!existing) return undefined
  const slug = generateUniqueSlug(db, input.title, existing.id)
  const now = new Date().toISOString()
  db.prepare(
    `UPDATE posts SET title = ?, slug = ?, body = ?, tags = ?, published = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.title,
    slug,
    input.body,
    JSON.stringify(input.tags),
    input.published ? 1 : 0,
    now,
    existing.id,
  )
  return getPostBySlug(slug)
}

export function deletePost(slug: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM posts WHERE slug = ?').run(slug)
  return result.changes > 0
}
