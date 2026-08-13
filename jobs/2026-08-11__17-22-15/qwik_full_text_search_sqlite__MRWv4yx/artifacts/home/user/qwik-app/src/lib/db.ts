import Database from 'better-sqlite3';
import { existsSync } from 'fs';

const dbPath = '/home/user/qwik-app/db.sqlite';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  db = new Database(dbPath);

  // Check if articles_fts table exists
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='articles_fts'"
  ).get();

  if (!tableExists) {
    db.exec("CREATE VIRTUAL TABLE articles_fts USING fts5(title, content);");
  }

  // Check if the table is empty to seed it
  const rowCount = db.prepare("SELECT count(*) as count FROM articles_fts").get() as { count: number };
  if (rowCount.count === 0) {
    const insert = db.prepare("INSERT INTO articles_fts (title, content) VALUES (?, ?)");

    // Article 1
    insert.run(
      "Introduction to Qwik",
      "Qwik is a new kind of web framework that can deliver instant loading web applications at any scale. It achieves this through resumability, which completely eliminates eager hydration."
    );

    // Article 2
    insert.run(
      "Understanding Resumability",
      "Resumability is the core innovation of Qwik. Unlike traditional hydration which downloads and executes all JavaScript on startup, Qwik serializes the application state and resumes execution instantly on user interaction."
    );

    // Article 3
    insert.run(
      "SQLite FTS5 Full-Text Search",
      "SQLite's FTS5 extension allows users to perform full-text search on virtual tables. It supports advanced queries, prefix matching, and generating highlighted snippets using the snippet function."
    );
  }

  return db;
}
