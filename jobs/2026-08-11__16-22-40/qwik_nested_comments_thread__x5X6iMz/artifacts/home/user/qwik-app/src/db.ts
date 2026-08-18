import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Ensure data directory exists
fs.mkdirSync('data', { recursive: true });
const dbPath = path.join(process.cwd(), 'data/comments.db');

export const db = new Database(dbPath);

// Enable WAL mode and foreign key constraints
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create comments table
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

// Seed the database if it is empty
const countResult = db.prepare('SELECT COUNT(*) as count FROM comments').get() as { count: number };
if (countResult.count === 0) {
  const insert = db.prepare(`
    INSERT INTO comments (parent_id, author, body, created_at)
    VALUES (?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  
  // Root: alice, body "Great article!"
  const res1 = insert.run(null, 'alice', 'Great article!', now);
  const aliceId = res1.lastInsertRowid;

  // Reply: bob, body "I agree."
  const res2 = insert.run(aliceId, 'bob', 'I agree.', now);
  const bobId = res2.lastInsertRowid;

  // Reply: carol, body "Well said."
  insert.run(bobId, 'carol', 'Well said.', now);

  // Root: dave, body "Any updates?"
  insert.run(null, 'dave', 'Any updates?', now);
}

export interface CommentNode {
  id: number;
  parent_id: number | null;
  author: string;
  body: string;
  created_at: string;
  depth: number;
  children: CommentNode[];
}

export function getAllCommentsTree(): CommentNode[] {
  const flatComments = db.prepare('SELECT * FROM comments ORDER BY id ASC').all() as any[];
  return buildCommentTree(flatComments);
}

export function buildCommentTree(flatComments: any[]): CommentNode[] {
  const map = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

  for (const c of flatComments) {
    map.set(c.id, {
      id: c.id,
      parent_id: c.parent_id,
      author: c.author,
      body: c.body,
      created_at: c.created_at,
      depth: 0,
      children: []
    });
  }

  for (const c of flatComments) {
    const node = map.get(c.id)!;
    if (c.parent_id === null || !map.has(c.parent_id)) {
      roots.push(node);
    } else {
      const parent = map.get(c.parent_id)!;
      parent.children.push(node);
    }
  }

  function computeDepth(node: CommentNode, currentDepth: number) {
    node.depth = currentDepth;
    for (const child of node.children) {
      computeDepth(child, currentDepth + 1);
    }
  }

  for (const root of roots) {
    computeDepth(root, 0);
  }

  return roots;
}

export function addComment(parentId: number | null, author: string, body: string): number {
  if (parentId !== null) {
    const parentExists = db.prepare('SELECT 1 FROM comments WHERE id = ?').get(parentId);
    if (!parentExists) {
      throw new Error("Parent comment does not exist");
    }
  }

  const insert = db.prepare(`
    INSERT INTO comments (parent_id, author, body, created_at)
    VALUES (?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const result = insert.run(parentId, author, body, now);
  return Number(result.lastInsertRowid);
}
