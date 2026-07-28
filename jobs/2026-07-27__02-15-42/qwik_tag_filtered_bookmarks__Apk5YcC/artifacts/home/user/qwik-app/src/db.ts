import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = '/home/user/qwik-app/data/bookmarks.db';

// Ensure directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

let dbInstance: Database.Database | null = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('foreign_keys = ON');
    
    // Create tables if they don't exist
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bookmark_tags (
        bookmark_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (bookmark_id, tag_id),
        FOREIGN KEY (bookmark_id) REFERENCES bookmarks (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
      );
    `);
  }
  return dbInstance;
}

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  tags: string[];
}

export function getBookmarks(filterTags?: string[]): Bookmark[] {
  const db = getDb();
  
  let matchingIds: number[] = [];
  
  if (filterTags && filterTags.length > 0) {
    // Deduplicate filter tags
    const uniqueFilterTags = Array.from(new Set(filterTags.map(t => t.trim()).filter(Boolean)));
    
    if (uniqueFilterTags.length === 0) {
      // If there were filter tags but they were empty strings, get all
      const rows = db.prepare('SELECT id FROM bookmarks').all() as { id: number }[];
      matchingIds = rows.map(r => r.id);
    } else {
      // Find bookmark IDs that have all the unique filter tags
      const placeholders = uniqueFilterTags.map(() => '?').join(',');
      const query = `
        SELECT b.id
        FROM bookmarks b
        JOIN bookmark_tags bt ON b.id = bt.bookmark_id
        JOIN tags t ON bt.tag_id = t.id
        WHERE t.name IN (${placeholders})
        GROUP BY b.id
        HAVING COUNT(DISTINCT t.name) = ?
      `;
      
      const rows = db.prepare(query).all(...uniqueFilterTags, uniqueFilterTags.length) as { id: number }[];
      matchingIds = rows.map(r => r.id);
    }
    
    if (matchingIds.length === 0) {
      return [];
    }
  } else {
    // No filter tags, get all bookmark IDs
    const rows = db.prepare('SELECT id FROM bookmarks').all() as { id: number }[];
    matchingIds = rows.map(r => r.id);
    
    if (matchingIds.length === 0) {
      return [];
    }
  }
  
  // Fetch details and all tags for matching bookmarks
  const placeholders = matchingIds.map(() => '?').join(',');
  const query = `
    SELECT b.id, b.url, b.title, t.name AS tag_name
    FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
    LEFT JOIN tags t ON bt.tag_id = t.id
    WHERE b.id IN (${placeholders})
    ORDER BY b.id ASC, t.name ASC
  `;
  
  const rows = db.prepare(query).all(...matchingIds) as { id: number; url: string; title: string; tag_name: string | null }[];
  
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
    if (row.tag_name !== null) {
      bookmarksMap.get(row.id)!.tags.push(row.tag_name);
    }
  }
  
  return Array.from(bookmarksMap.values());
}

export function createBookmark(url: string, title: string, tags: string[]): Bookmark {
  const db = getDb();
  
  // Collapse duplicate tag names, trim and filter empty ones
  const processedTags = Array.from(
    new Set(
      tags
        .map(t => t.trim())
        .filter(t => t.length > 0)
    )
  );
  
  const insertTransaction = db.transaction(() => {
    // 1. Insert bookmark
    const bookmarkStmt = db.prepare('INSERT INTO bookmarks (url, title) VALUES (?, ?)');
    const result = bookmarkStmt.run(url, title);
    const bookmarkId = result.lastInsertRowid as number;
    
    // 2. Insert tags (or ignore if already exists) and get their IDs
    const tagStmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const selectTagStmt = db.prepare('SELECT id FROM tags WHERE name = ?');
    const insertJoinStmt = db.prepare('INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
    
    for (const tagName of processedTags) {
      tagStmt.run(tagName);
      const tagRow = selectTagStmt.get(tagName) as { id: number };
      insertJoinStmt.run(bookmarkId, tagRow.id);
    }
    
    return {
      id: bookmarkId,
      url,
      title,
      tags: [...processedTags].sort()
    };
  });
  
  return insertTransaction();
}

// Helper to get all distinct tags (useful for rendering tags in UI)
export function getAllTags(): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT name FROM tags ORDER BY name ASC').all() as { name: string }[];
  return rows.map(r => r.name);
}
