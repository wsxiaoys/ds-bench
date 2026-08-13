import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = '/home/user/qwik-app/db.sqlite';

interface GlobalWithDb {
  _db?: Database.Database;
}

const g = globalThis as unknown as GlobalWithDb;

if (!g._db) {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Initialize and seed if empty or doesn't exist
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='articles_fts'").get();

  if (!tableExists) {
    db.exec("CREATE VIRTUAL TABLE articles_fts USING fts5(title, content);");
  }

  const countRow = db.prepare("SELECT count(*) as count FROM articles_fts").get() as { count: number } | undefined;
  if (!countRow || countRow.count === 0) {
    const insert = db.prepare("INSERT INTO articles_fts (title, content) VALUES (?, ?)");
    const articles = [
      {
        title: "Introduction to Qwik",
        content: "Qwik is a new kind of web framework that can deliver instant loading web applications at any scale. It achieves this through resumability, which completely eliminates eager hydration."
      },
      {
        title: "Understanding Resumability",
        content: "Resumability is the core innovation of Qwik. Unlike traditional hydration which downloads and executes all JavaScript on startup, Qwik serializes the application state and resumes execution instantly on user interaction."
      },
      {
        title: "SQLite FTS5 Full-Text Search",
        content: "SQLite's FTS5 extension allows users to perform full-text search on virtual tables. It supports advanced queries, prefix matching, and generating highlighted snippets using the snippet function."
      }
    ];

    for (const article of articles) {
      insert.run(article.title, article.content);
    }
  }

  g._db = db;
}

export const db = g._db;
