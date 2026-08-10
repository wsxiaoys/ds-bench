import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

// Ensure data directory exists
const dbDir = path.resolve('data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'comments.db');
const db = new Database(dbPath);

// Enable WAL mode and busy timeout for concurrent writers
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

// Create comments table
db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER REFERENCES comments(id),
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Seed database if empty
db.transaction(() => {
  const count = db.prepare('SELECT COUNT(*) as count FROM comments').get() as { count: number };
  if (count.count === 0) {
    const insertStmt = db.prepare('INSERT INTO comments (parent_id, author, body, created_at) VALUES (?, ?, ?, ?)');
    
    // Alice
    const resAlice = insertStmt.run(null, 'alice', 'Great article!', new Date().toISOString());
    const aliceId = resAlice.lastInsertRowid;

    // Bob
    const resBob = insertStmt.run(aliceId, 'bob', 'I agree.', new Date().toISOString());
    const bobId = resBob.lastInsertRowid;

    // Carol
    insertStmt.run(bobId, 'carol', 'Well said.', new Date().toISOString());

    // Dave
    insertStmt.run(null, 'dave', 'Any updates?', new Date().toISOString());
  }
})();

export interface CommentRow {
  id: number;
  parent_id: number | null;
  author: string;
  body: string;
  created_at: string;
}

export interface CommentNode {
  id: number;
  parentId: number | null;
  author: string;
  body: string;
  createdAt: string;
  depth: number;
  children: CommentNode[];
}

export function getAllCommentsTree(): CommentNode[] {
  const rows = db.prepare('SELECT * FROM comments ORDER BY id ASC').all() as CommentRow[];
  
  const map = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

  // Create nodes
  for (const row of rows) {
    const node: CommentNode = {
      id: row.id,
      parentId: row.parent_id,
      author: row.author,
      body: row.body,
      createdAt: row.created_at,
      depth: 0,
      children: []
    };
    map.set(row.id, node);
  }

  // Build tree
  for (const node of map.values()) {
    if (node.parentId === null) {
      roots.push(node);
    } else {
      const parent = map.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Fallback: if parent not found, treat as root
        roots.push(node);
      }
    }
  }

  // Assign depths recursively
  function assignDepth(node: CommentNode, currentDepth: number) {
    node.depth = currentDepth;
    for (const child of node.children) {
      assignDepth(child, currentDepth + 1);
    }
  }

  for (const root of roots) {
    assignDepth(root, 0);
  }

  return roots;
}

export function addComment(parentId: number | null, author: string, body: string): CommentRow {
  // Verify parent exists if parentId is provided
  if (parentId !== null) {
    const parentExists = db.prepare('SELECT 1 FROM comments WHERE id = ?').get(parentId);
    if (!parentExists) {
      throw new Error(`Parent comment with id ${parentId} does not exist`);
    }
  }

  const createdAt = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO comments (parent_id, author, body, created_at) VALUES (?, ?, ?, ?)');
  const info = stmt.run(parentId, author, body, createdAt);
  
  return {
    id: Number(info.lastInsertRowid),
    parent_id: parentId,
    author,
    body,
    created_at: createdAt
  };
}
