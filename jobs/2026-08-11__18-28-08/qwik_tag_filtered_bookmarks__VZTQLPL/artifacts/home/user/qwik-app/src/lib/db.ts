import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_DIR = '/home/user/qwik-app/data';
const DB_PATH = path.join(DB_DIR, 'bookmarks.db');

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Initialize schema
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
    bookmark_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (bookmark_id, tag_id),
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );
`);

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  tags: string[];
}

export function getAllTags(): string[] {
  const stmt = db.prepare('SELECT name FROM tags ORDER BY name ASC');
  const rows = stmt.all() as { name: string }[];
  return rows.map(r => r.name);
}

export function getBookmarks(tagsFilter?: string[]): Bookmark[] {
  if (tagsFilter && tagsFilter.length > 0) {
    // 1. Find matching bookmark IDs with AND semantics
    const placeholders = tagsFilter.map(() => '?').join(',');
    const matchQuery = `
      SELECT b.id
      FROM bookmarks b
      JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      JOIN tags t ON bt.tag_id = t.id
      WHERE t.name IN (${placeholders})
      GROUP BY b.id
      HAVING COUNT(DISTINCT t.id) = ?
    `;
    
    const stmtMatch = db.prepare(matchQuery);
    const params = [...tagsFilter, tagsFilter.length];
    const matches = stmtMatch.all(...params) as { id: number }[];
    
    if (matches.length === 0) {
      return [];
    }
    
    const matchingIds = matches.map(m => m.id);
    const idPlaceholders = matchingIds.map(() => '?').join(',');
    
    // 2. Fetch full bookmark details and all of their tags
    const detailsQuery = `
      SELECT b.id, b.url, b.title, t.name as tag_name
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      LEFT JOIN tags t ON bt.tag_id = t.id
      WHERE b.id IN (${idPlaceholders})
      ORDER BY b.id ASC, t.name ASC
    `;
    
    const stmtDetails = db.prepare(detailsQuery);
    const rows = stmtDetails.all(...matchingIds) as { id: number; url: string; title: string; tag_name: string | null }[];
    
    return groupRowsToBookmarks(rows);
  } else {
    // Fetch all bookmarks and all of their tags
    const query = `
      SELECT b.id, b.url, b.title, t.name as tag_name
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      LEFT JOIN tags t ON bt.tag_id = t.id
      ORDER BY b.id ASC, t.name ASC
    `;
    const stmt = db.prepare(query);
    const rows = stmt.all() as { id: number; url: string; title: string; tag_name: string | null }[];
    
    return groupRowsToBookmarks(rows);
  }
}

function groupRowsToBookmarks(rows: { id: number; url: string; title: string; tag_name: string | null }[]): Bookmark[] {
  const bookmarksMap = new Map<number, Bookmark>();
  
  for (const row of rows) {
    if (!bookmarksMap.has(row.id)) {
      bookmarksMap.set(row.id, {
        id: row.id,
        url: row.url,
        title: row.title,
        tags: []
      });
    }
    if (row.tag_name !== null && row.tag_name !== undefined) {
      bookmarksMap.get(row.id)!.tags.push(row.tag_name);
    }
  }
  
  const bookmarks = Array.from(bookmarksMap.values());
  for (const b of bookmarks) {
    b.tags.sort((a, b) => a.localeCompare(b));
  }
  
  return bookmarks;
}

export function createBookmark(url: string, title: string, tagsInput: string[]): Bookmark {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error('URL is required');
  }
  if (!title || typeof title !== 'string' || title.trim() === '') {
    throw new Error('Title is required');
  }

  // De-duplicate and trim tags
  const tags = Array.from(
    new Set(
      tagsInput
        .map(t => t.trim())
        .filter(t => t.length > 0)
    )
  );

  const insertBookmark = db.prepare('INSERT INTO bookmarks (url, title) VALUES (?, ?)');
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const getTagId = db.prepare('SELECT id FROM tags WHERE name = ?');
  const insertAssociation = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');

  let bookmarkId: number;

  const transaction = db.transaction(() => {
    const info = insertBookmark.run(url.trim(), title.trim());
    bookmarkId = Number(info.lastInsertRowid);

    for (const tag of tags) {
      insertTag.run(tag);
      const tagRow = getTagId.get(tag) as { id: number };
      insertAssociation.run(bookmarkId, tagRow.id);
    }
  });

  transaction();

  return {
    id: bookmarkId!,
    url: url.trim(),
    title: title.trim(),
    tags: [...tags].sort((a, b) => a.localeCompare(b))
  };
}
