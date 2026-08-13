import sqlite3 from "sqlite3";

const dbPath = "/home/user/qwik-app/gallery.db";

export interface ImageRecord {
  id: number;
  original_name: string;
  original_path: string;
  optimized_path: string;
  width: number;
  height: number;
  uploaded_at?: string;
}

export async function executeInDb<T>(
  callback: (db: sqlite3.Database) => Promise<T>,
): Promise<T> {
  const db = await new Promise<sqlite3.Database>((resolve, reject) => {
    const d = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else resolve(d);
    });
  });
  try {
    return await callback(db);
  } finally {
    await new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export async function initDb(): Promise<void> {
  await executeInDb(async (db) => {
    return new Promise<void>((resolve, reject) => {
      db.run(
        `
        CREATE TABLE IF NOT EXISTS images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          original_name TEXT NOT NULL,
          original_path TEXT NOT NULL,
          optimized_path TEXT NOT NULL,
          width INTEGER NOT NULL,
          height INTEGER NOT NULL,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });
  });
}

export async function getAllImages(): Promise<ImageRecord[]> {
  await initDb();
  return executeInDb(async (db) => {
    return new Promise<ImageRecord[]>((resolve, reject) => {
      db.all(
        `
        SELECT id, original_name, original_path, optimized_path, width, height, uploaded_at
        FROM images
        ORDER BY uploaded_at DESC
      `,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as ImageRecord[]);
        },
      );
    });
  });
}

export async function insertImage(
  originalName: string,
  originalPath: string,
  optimizedPath: string,
  width: number,
  height: number,
): Promise<void> {
  await initDb();
  await executeInDb(async (db) => {
    return new Promise<void>((resolve, reject) => {
      db.run(
        `
        INSERT INTO images (original_name, original_path, optimized_path, width, height)
        VALUES (?, ?, ?, ?, ?)
      `,
        [originalName, originalPath, optimizedPath, width, height],
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });
  });
}
