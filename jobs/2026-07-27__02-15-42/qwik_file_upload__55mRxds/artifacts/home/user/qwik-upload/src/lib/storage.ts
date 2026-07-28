import Database from 'better-sqlite3';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const PROJECT_ROOT = '/home/user/qwik-upload';
const DB_PATH = join(PROJECT_ROOT, 'db.sqlite');
const UPLOADS_DIR = join(PROJECT_ROOT, 'uploads');

export interface FileMetadata {
  originalName: string;
  storedName: string;
  size: number;
  sha256: string;
  contentType: string;
}

let db: any = null;

export function getDb() {
  if (!db) {
    if (!existsSync(UPLOADS_DIR)) {
      mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        originalName TEXT NOT NULL,
        storedName TEXT NOT NULL,
        size INTEGER NOT NULL,
        sha256 TEXT NOT NULL UNIQUE,
        contentType TEXT NOT NULL
      )
    `);
  }
  return db;
}

export function getFiles(): FileMetadata[] {
  const database = getDb();
  return database.prepare('SELECT originalName, storedName, size, sha256, contentType FROM files').all() as FileMetadata[];
}

export function getFileByStoredName(storedName: string): FileMetadata | null {
  const database = getDb();
  return database.prepare('SELECT originalName, storedName, size, sha256, contentType FROM files WHERE storedName = ?').get(storedName) as FileMetadata | null;
}

export function getFilePath(storedName: string): string {
  return join(UPLOADS_DIR, storedName);
}

export function sanitizeFilename(name: string): string {
  if (!name) return 'file';
  // Remove directory components by splitting by / and \
  const parts = name.split(/[/\\]/);
  let base = parts[parts.length - 1] || 'file';
  
  // If the base itself is '.' or '..' or empty, reset to 'file'
  if (base === '.' || base === '..') {
    base = 'file';
  }
  
  // Remove any occurrences of '..'
  base = base.replace(/\.\./g, '');
  
  // Remove double quotes to prevent HTTP header issues
  base = base.replace(/"/g, '');
  
  // Trim spaces
  base = base.trim();
  if (!base) base = 'file';
  return base;
}

export function saveFile(buffer: Buffer, originalName: string, contentType: 'image/png' | 'application/pdf') {
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const size = buffer.length;

  const ext = contentType === 'image/png' ? 'png' : 'pdf';
  const storedName = `${sha256}.${ext}`;
  const storedFilePath = join(UPLOADS_DIR, storedName);

  const database = getDb();

  // Check if a file with this sha256 already exists in DB
  const existing = database.prepare('SELECT originalName, storedName, size, sha256, contentType FROM files WHERE sha256 = ?').get(sha256) as FileMetadata | null;

  if (existing) {
    return {
      success: true,
      dedup: true,
      file: existing
    };
  }

  // Write file to filesystem if it doesn't exist
  if (!existsSync(storedFilePath)) {
    writeFileSync(storedFilePath, buffer);
  }

  // Try to insert into database
  try {
    database.prepare(`
      INSERT INTO files (originalName, storedName, size, sha256, contentType)
      VALUES (?, ?, ?, ?, ?)
    `).run(originalName, storedName, size, sha256, contentType);

    return {
      success: true,
      dedup: false,
      file: {
        originalName,
        storedName,
        size,
        sha256,
        contentType
      }
    };
  } catch (err: any) {
    // Unique constraint violation (race condition)
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message?.includes('UNIQUE constraint failed')) {
      const concurrentExisting = database.prepare('SELECT originalName, storedName, size, sha256, contentType FROM files WHERE sha256 = ?').get(sha256) as FileMetadata;
      return {
        success: true,
        dedup: true,
        file: concurrentExisting
      };
    }
    throw err;
  }
}
