import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "bookmarks.db");

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

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

  dbInstance = db;
  return dbInstance;
}

export interface BookmarkRecord {
  id: number;
  url: string;
  title: string;
  tags: string[];
}

/**
 * Get or create a tag row for the given name, returning its id.
 * Reuses an existing tag row if the name already exists.
 */
function getOrCreateTagId(db: Database.Database, name: string): number {
  const existing = db
    .prepare("SELECT id FROM tags WHERE name = ?")
    .get(name) as { id: number } | undefined;
  if (existing) {
    return existing.id;
  }
  const result = db.prepare("INSERT INTO tags (name) VALUES (?)").run(name);
  return Number(result.lastInsertRowid);
}

/**
 * Create a new bookmark along with its tag associations.
 * Duplicate tag names are collapsed, and existing tag rows are reused.
 */
export function createBookmark(
  url: string,
  title: string,
  tagNames: string[],
): BookmarkRecord {
  const db = getDb();

  const uniqueTagNames = Array.from(
    new Set(
      tagNames
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    ),
  );

  const insertBookmark = db.prepare(
    "INSERT INTO bookmarks (url, title) VALUES (?, ?)",
  );
  const linkTag = db.prepare(
    "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
  );

  const create = db.transaction(() => {
    const result = insertBookmark.run(url, title);
    const bookmarkId = Number(result.lastInsertRowid);

    for (const tagName of uniqueTagNames) {
      const tagId = getOrCreateTagId(db, tagName);
      linkTag.run(bookmarkId, tagId);
    }

    return bookmarkId;
  });

  const bookmarkId = create();

  return {
    id: bookmarkId,
    url,
    title,
    tags: [...uniqueTagNames].sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * List bookmarks, optionally filtered by a set of tag names using AND semantics:
 * a bookmark is included only if it has every one of the given tags.
 */
export function listBookmarks(tagNames: string[]): BookmarkRecord[] {
  const db = getDb();

  const uniqueTagNames = Array.from(
    new Set(tagNames.map((t) => t.trim()).filter((t) => t.length > 0)),
  );

  let bookmarkRows: { id: number; url: string; title: string }[];

  if (uniqueTagNames.length === 0) {
    bookmarkRows = db
      .prepare("SELECT id, url, title FROM bookmarks ORDER BY id ASC")
      .all() as { id: number; url: string; title: string }[];
  } else {
    const placeholders = uniqueTagNames.map(() => "?").join(", ");
    bookmarkRows = db
      .prepare(
        `
        SELECT b.id as id, b.url as url, b.title as title
        FROM bookmarks b
        JOIN bookmark_tags bt ON bt.bookmark_id = b.id
        JOIN tags t ON t.id = bt.tag_id
        WHERE t.name IN (${placeholders})
        GROUP BY b.id
        HAVING COUNT(DISTINCT t.name) = ?
        ORDER BY b.id ASC
        `,
      )
      .all(...uniqueTagNames, uniqueTagNames.length) as {
      id: number;
      url: string;
      title: string;
    }[];
  }

  const tagsForBookmark = db.prepare(
    `
    SELECT t.name as name
    FROM tags t
    JOIN bookmark_tags bt ON bt.tag_id = t.id
    WHERE bt.bookmark_id = ?
    ORDER BY t.name ASC
    `,
  );

  return bookmarkRows.map((row) => {
    const tags = (
      tagsForBookmark.all(row.id) as { name: string }[]
    ).map((t) => t.name);
    return {
      id: row.id,
      url: row.url,
      title: row.title,
      tags,
    };
  });
}
