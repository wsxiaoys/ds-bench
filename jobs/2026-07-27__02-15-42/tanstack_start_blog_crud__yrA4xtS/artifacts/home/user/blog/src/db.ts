import { createRequire } from 'module';

let db: any = null;

export function getDb() {
  if (typeof window !== 'undefined') {
    return null;
  }
  if (!db) {
    const require = createRequire(import.meta.url);
    const Database = require('better-sqlite3');
    db = new Database('/home/user/blog/blog.db');
    
    // Create tables if they do not exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        body TEXT NOT NULL,
        published INTEGER NOT NULL DEFAULT 0,
        tags TEXT NOT NULL
      );
    `);
  }
  return db;
}

export function parseTags(tagsStr: string): string[] {
  if (!tagsStr) return [];
  return tagsStr
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

export function generateSlug(title: string, excludePostId?: number): string {
  const database = getDb();
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  if (!slug) {
    slug = 'post';
  }

  let candidate = slug;
  let n = 2;
  while (true) {
    const query = excludePostId
      ? database.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?')
      : database.prepare('SELECT id FROM posts WHERE slug = ?');
    const params = excludePostId ? [candidate, excludePostId] : [candidate];
    const row = query.get(...params);
    if (!row) {
      return candidate;
    }
    candidate = `${slug}-${n}`;
    n++;
  }
}
