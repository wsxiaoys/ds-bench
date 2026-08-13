import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = '/home/user/qwik-app/db.sqlite';

// Ensure the directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db: any = null;

function seedDb(database: any) {
  const insert = database.prepare('INSERT INTO articles_fts (title, content) VALUES (?, ?)');
  
  const articles = [
    {
      title: 'Introduction to Qwik',
      content: 'Qwik is a new kind of web framework that can deliver instant loading web applications at any scale. It achieves this through resumability, which completely eliminates eager hydration.'
    },
    {
      title: 'Understanding Resumability',
      content: 'Resumability is the core innovation of Qwik. Unlike traditional hydration which downloads and executes all JavaScript on startup, Qwik serializes the application state and resumes execution instantly on user interaction.'
    },
    {
      title: 'SQLite FTS5 Full-Text Search',
      content: 'SQLite\'s FTS5 extension allows users to perform full-text search on virtual tables. It supports advanced queries, prefix matching, and generating highlighted snippets using the snippet function.'
    }
  ];

  const transaction = database.transaction((items: typeof articles) => {
    for (const item of items) {
      insert.run(item.title, item.content);
    }
  });

  transaction(articles);
}

function initAndSeedDb(database: any) {
  database.exec(`CREATE VIRTUAL TABLE articles_fts USING fts5(title, content);`);
  seedDb(database);
}

export function getDb() {
  if (db) {
    return db;
  }

  const dbExists = fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 0;

  db = new Database(DB_PATH);

  // Enable WAL mode for performance
  db.pragma('journal_mode = WAL');

  if (!dbExists) {
    initAndSeedDb(db);
  } else {
    // Just in case the file exists but table doesn't or is empty
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='articles_fts'"
    ).get();

    if (!tableExists) {
      initAndSeedDb(db);
    } else {
      const rowCountResult = db.prepare("SELECT count(*) as count FROM articles_fts").get() as { count: number };
      if (rowCountResult.count === 0) {
        seedDb(db);
      }
    }
  }

  return db;
}
