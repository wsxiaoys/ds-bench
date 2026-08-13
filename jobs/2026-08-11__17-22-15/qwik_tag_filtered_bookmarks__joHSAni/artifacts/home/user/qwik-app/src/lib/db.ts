import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = '/home/user/qwik-app/data/bookmarks.db';

// Ensure directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema on startup
db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS bookmark_tags (
    bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bookmark_id, tag_id)
  );
`);

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  tags: string[];
}

export function getBookmarks(filterTags: string[]): Bookmark[] {
  // Filter out empty strings and deduplicate
  const cleanFilterTags = Array.from(new Set(filterTags.map(t => t.trim()).filter(t => t.length > 0)));

  let bookmarkIds: number[] = [];
  if (cleanFilterTags.length > 0) {
    // Find bookmark IDs that have ALL the cleanFilterTags
    const placeholders = cleanFilterTags.map(() => '?').join(',');
    const query = `
      SELECT bookmark_id FROM bookmark_tags
      JOIN tags ON bookmark_tags.tag_id = tags.id
      WHERE tags.name IN (${placeholders})
      GROUP BY bookmark_id
      HAVING COUNT(DISTINCT tags.name) = ?
    `;
    const rows = db.prepare(query).all(...cleanFilterTags, cleanFilterTags.length) as { bookmark_id: number }[];
    bookmarkIds = rows.map(r => r.bookmark_id);

    if (bookmarkIds.length === 0) {
      return [];
    }
  }

  // Fetch bookmarks and their tags
  let query = `
    SELECT b.id, b.url, b.title, t.name as tag_name
    FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
    LEFT JOIN tags t ON bt.tag_id = t.id
  `;

  let params: any[] = [];
  if (cleanFilterTags.length > 0) {
    const placeholders = bookmarkIds.map(() => '?').join(',');
    query += ` WHERE b.id IN (${placeholders})`;
    params = bookmarkIds;
  }

  query += ` ORDER BY b.id ASC`;

  const rows = db.prepare(query).all(...params) as { id: number; url: string; title: string; tag_name: string | null }[];

  // Group tags by bookmark
  const bookmarkMap = new Map<number, Bookmark>();
  for (const row of rows) {
    if (!bookmarkMap.has(row.id)) {
      bookmarkMap.set(row.id, {
        id: row.id,
        url: row.url,
        title: row.title,
        tags: []
      });
    }
    if (row.tag_name !== null) {
      bookmarkMap.get(row.id)!.tags.push(row.tag_name);
    }
  }

  const result = Array.from(bookmarkMap.values());
  // Sort tags ascending for each bookmark
  for (const bookmark of result) {
    bookmark.tags.sort((a, b) => a.localeCompare(b));
  }

  return result;
}

export const insertBookmarkWithTags = db.transaction((url: string, title: string, tagNames: string[]): Bookmark => {
  // 1. Insert the bookmark
  const insertBookmarkStmt = db.prepare('INSERT INTO bookmarks (url, title) VALUES (?, ?)');
  const info = insertBookmarkStmt.run(url, title);
  const bookmarkId = Number(info.lastInsertRowid);

  // 2. Process tags
  // Collapse duplicate tag names and filter out empty ones
  const uniqueTagNames = Array.from(new Set(tagNames.map(t => t.trim()).filter(t => t.length > 0)));

  for (const tagName of uniqueTagNames) {
    // Try to insert the tag, or ignore if it exists
    const insertTagStmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    insertTagStmt.run(tagName);

    // Get the tag ID
    const getTagStmt = db.prepare('SELECT id FROM tags WHERE name = ?');
    const tagRow = getTagStmt.get(tagName) as { id: number };
    const tagId = tagRow.id;

    // Associate bookmark and tag
    const insertJoinStmt = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
    insertJoinStmt.run(bookmarkId, tagId);
  }

  // Return the created bookmark object
  const sortedTags = [...uniqueTagNames].sort((a, b) => a.localeCompare(b));
  return {
    id: bookmarkId,
    url,
    title,
    tags: sortedTags,
  };
});
