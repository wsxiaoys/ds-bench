import { getDB } from "./db";

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  tags: string[];
}

export function cleanTagList(tags: string[]): string[] {
  const uniqueTags = new Set(
    tags
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
  );
  return Array.from(uniqueTags).sort((a, b) => a.localeCompare(b));
}

export function getBookmarks(filterTags?: string[]): Bookmark[] {
  const db = getDB();

  let matchedIds: number[] | null = null;

  if (filterTags && filterTags.length > 0) {
    // Unique requested tags
    const uniqueFilterTags = Array.from(new Set(filterTags.map((t) => t.trim()).filter((t) => t.length > 0)));
    if (uniqueFilterTags.length > 0) {
      const placeholders = uniqueFilterTags.map(() => "?").join(",");
      const stmt = db.prepare(`
        SELECT bt.bookmark_id
        FROM bookmark_tags bt
        JOIN tags t ON bt.tag_id = t.id
        WHERE t.name IN (${placeholders})
        GROUP BY bt.bookmark_id
        HAVING COUNT(DISTINCT t.name) = ?
      `);
      const rows = stmt.all(...uniqueFilterTags, uniqueFilterTags.length) as { bookmark_id: number }[];
      matchedIds = rows.map((r) => r.bookmark_id);

      if (matchedIds.length === 0) {
        return [];
      }
    }
  }

  // Fetch bookmarks
  let bookmarksQuery = "SELECT id, url, title FROM bookmarks";
  const params: any[] = [];

  if (matchedIds !== null) {
    const placeholders = matchedIds.map(() => "?").join(",");
    bookmarksQuery += ` WHERE id IN (${placeholders})`;
    params.push(...matchedIds);
  }

  bookmarksQuery += " ORDER BY id ASC";

  const bookmarksStmt = db.prepare(bookmarksQuery);
  const bookmarksRows = bookmarksStmt.all(...params) as { id: number; url: string; title: string }[];

  if (bookmarksRows.length === 0) {
    return [];
  }

  // Fetch all tags for these bookmarks
  const bookmarkIds = bookmarksRows.map((b) => b.id);
  const tagPlaceholders = bookmarkIds.map(() => "?").join(",");
  const tagsStmt = db.prepare(`
    SELECT bt.bookmark_id, t.name
    FROM bookmark_tags bt
    JOIN tags t ON bt.tag_id = t.id
    WHERE bt.bookmark_id IN (${tagPlaceholders})
    ORDER BY t.name ASC
  `);
  const tagsRows = tagsStmt.all(...bookmarkIds) as { bookmark_id: number; name: string }[];

  const tagsByBookmarkId: Record<number, string[]> = {};
  for (const tr of tagsRows) {
    if (!tagsByBookmarkId[tr.bookmark_id]) {
      tagsByBookmarkId[tr.bookmark_id] = [];
    }
    tagsByBookmarkId[tr.bookmark_id].push(tr.name);
  }

  return bookmarksRows.map((b) => ({
    id: b.id,
    url: b.url,
    title: b.title,
    tags: tagsByBookmarkId[b.id] || [],
  }));
}

export function addBookmark(url: string, title: string, tagsInput: string[]): Bookmark {
  const db = getDB();

  const cleanTags = cleanTagList(tagsInput);

  const insertBookmark = db.prepare(`INSERT INTO bookmarks (url, title) VALUES (?, ?)`);
  const insertTag = db.prepare(`INSERT OR IGNORE INTO tags (name) VALUES (?)`);
  const selectTagId = db.prepare(`SELECT id FROM tags WHERE name = ?`);
  const insertBookmarkTag = db.prepare(`INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)`);

  const runTx = db.transaction((urlVal: string, titleVal: string, tagsVal: string[]) => {
    const result = insertBookmark.run(urlVal, titleVal);
    const bookmarkId = result.lastInsertRowid as number;

    for (const tag of tagsVal) {
      insertTag.run(tag);
      const tagRow = selectTagId.get(tag) as { id: number };
      insertBookmarkTag.run(bookmarkId, tagRow.id);
    }

    return bookmarkId;
  });

  const id = runTx(url, title, cleanTags);

  return {
    id,
    url,
    title,
    tags: cleanTags,
  };
}

export function getAllTags(): string[] {
  const db = getDB();
  const stmt = db.prepare("SELECT name FROM tags ORDER BY name ASC");
  const rows = stmt.all() as { name: string }[];
  return rows.map((r) => r.name);
}
