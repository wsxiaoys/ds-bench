// Server-only SQLite access for the comments feature.
// This module must never be imported from client-executed code paths;
// it is only ever used from routeLoader$ / routeAction$ handlers, which
// run exclusively on the server.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export interface CommentRow {
  id: number;
  parent_id: number | null;
  author: string;
  body: string;
  created_at: string;
}

export interface CommentNode extends CommentRow {
  depth: number;
  children: CommentNode[];
}

const DB_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "comments.db");

// Cache the single database connection on `globalThis` so that Vite's
// dev-server module reloads (HMR) don't leave us with multiple open
// connections to the same SQLite file.
declare global {
  // eslint-disable-next-line no-var
  var __commentsDb: InstanceType<typeof Database> | undefined;
}

function seedIfEmpty(db: InstanceType<typeof Database>) {
  const { count } = db
    .prepare(`SELECT COUNT(*) as count FROM comments`)
    .get() as { count: number };

  if (count > 0) return;

  const insert = db.prepare(
    `INSERT INTO comments (parent_id, author, body, created_at) VALUES (?, ?, ?, ?)`,
  );

  const seed = db.transaction(() => {
    const now = () => new Date().toISOString();

    const aliceId = insert.run(null, "alice", "Great article!", now())
      .lastInsertRowid as number;
    const bobId = insert.run(aliceId, "bob", "I agree.", now())
      .lastInsertRowid as number;
    insert.run(bobId, "carol", "Well said.", now());

    insert.run(null, "dave", "Any updates?", now());
  });

  seed();
}

function createConnection() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);

  // WAL mode tolerates concurrent readers/writers much better than the
  // default rollback journal, and a busy timeout makes writers wait for
  // each other instead of immediately throwing SQLITE_BUSY.
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER REFERENCES comments(id),
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  seedIfEmpty(db);

  return db;
}

export function getDb() {
  if (!globalThis.__commentsDb) {
    globalThis.__commentsDb = createConnection();
  }
  return globalThis.__commentsDb;
}

/** Returns every comment row ordered by id ascending (insertion order). */
export function getAllCommentRows(): CommentRow[] {
  const db = getDb();
  return db
    .prepare(`SELECT id, parent_id, author, body, created_at FROM comments ORDER BY id ASC`)
    .all() as CommentRow[];
}

/**
 * Builds the comment tree (and computes each node's depth) from a flat,
 * id-ascending list of rows. Because a comment's `parent_id` is always a
 * smaller id than its own id (parents are always inserted before their
 * children), a single pass in id order is enough to guarantee that every
 * parent's depth has already been computed before its children are
 * processed.
 */
export function buildCommentTree(rows: CommentRow[]): CommentNode[] {
  const nodeMap = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

  for (const row of rows) {
    nodeMap.set(row.id, { ...row, depth: 0, children: [] });
  }

  for (const row of rows) {
    const node = nodeMap.get(row.id)!;
    const parent =
      row.parent_id != null ? nodeMap.get(row.parent_id) : undefined;

    if (parent) {
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      node.depth = 0;
      roots.push(node);
    }
  }

  return roots;
}

/** Whether a comment with the given id currently exists. */
export function commentExists(id: number): boolean {
  const db = getDb();
  const row = db.prepare(`SELECT id FROM comments WHERE id = ?`).get(id);
  return !!row;
}

/**
 * Inserts a single new comment. `created_at` is always assigned by the
 * server; callers must never be able to supply their own timestamp.
 */
export function insertComment(
  parentId: number | null,
  author: string,
  body: string,
): CommentRow {
  const db = getDb();
  const created_at = new Date().toISOString();

  const info = db
    .prepare(
      `INSERT INTO comments (parent_id, author, body, created_at) VALUES (?, ?, ?, ?)`,
    )
    .run(parentId, author, body, created_at);

  return {
    id: info.lastInsertRowid as number,
    parent_id: parentId,
    author,
    body,
    created_at,
  };
}
