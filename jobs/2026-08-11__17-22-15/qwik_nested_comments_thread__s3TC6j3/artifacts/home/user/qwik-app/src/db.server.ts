import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export interface Comment {
  id: number;
  parent_id: number | null;
  author: string;
  body: string;
  created_at: string;
  depth: number;
  children: Comment[];
}

let db: Database.Database | null = null;

export function getDb() {
  if (db) return db;

  const dbDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'comments.db');
  db = new Database(dbPath);

  // Enable WAL mode and busy timeout for concurrent writers
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  // Create table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    );
  `);

  // Check if table is empty
  const row = db.prepare('SELECT COUNT(*) as count FROM comments').get() as { count: number };
  if (row.count === 0) {
    // Seed the initial threads
    const insert = db.prepare(`
      INSERT INTO comments (parent_id, author, body, created_at)
      VALUES (?, ?, ?, ?)
    `);

    db.transaction(() => {
      const now = new Date().toISOString();
      
      // Root: alice (Great article!)
      const res1 = insert.run(null, 'alice', 'Great article!', now);
      const aliceId = res1.lastInsertRowid;

      // Reply: bob (I agree.) -> alice
      const res2 = insert.run(aliceId, 'bob', 'I agree.', now);
      const bobId = res2.lastInsertRowid;

      // Reply: carol (Well said.) -> bob
      insert.run(bobId, 'carol', 'Well said.', now);

      // Root: dave (Any updates?)
      insert.run(null, 'dave', 'Any updates?', now);
    })();
  }

  return db;
}

export function getCommentTree(): Comment[] {
  const database = getDb();
  const rows = database.prepare('SELECT * FROM comments ORDER BY id ASC').all() as any[];

  const commentMap = new Map<number, Comment>();
  const roots: Comment[] = [];

  // First pass: create all Comment objects
  for (const row of rows) {
    commentMap.set(row.id, {
      id: row.id,
      parent_id: row.parent_id,
      author: row.author,
      body: row.body,
      created_at: row.created_at,
      depth: 0,
      children: [],
    });
  }

  // Second pass: associate children and compute depth
  for (const row of rows) {
    const comment = commentMap.get(row.id)!;
    if (row.parent_id === null) {
      comment.depth = 0;
      roots.push(comment);
    } else {
      const parent = commentMap.get(row.parent_id);
      if (parent) {
        comment.depth = parent.depth + 1;
        parent.children.push(comment);
      } else {
        // Fallback for missing parent
        comment.depth = 0;
        roots.push(comment);
      }
    }
  }

  return roots;
}
