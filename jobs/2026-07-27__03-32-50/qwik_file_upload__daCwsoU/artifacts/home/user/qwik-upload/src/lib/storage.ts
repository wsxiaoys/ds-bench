/**
 * Server-only storage layer for the secure file upload feature.
 *
 * This module is only ever imported from `routeAction$` / `routeLoader$` /
 * `onGet` handlers (see `src/routes`), which Qwik City only ever executes on
 * the server. Nothing here is safe to run in a browser (it touches the local
 * filesystem and a native SQLite binding), so it must never be imported from
 * component render code that is reachable from the client bundle.
 */
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type ContentType = 'image/png' | 'application/pdf';

export interface StoredFileRecord {
  originalName: string;
  storedName: string;
  size: number;
  sha256: string;
  contentType: ContentType;
}

export interface SaveUploadResult {
  file: StoredFileRecord;
  /** `true` when the content already existed and no new file/row was created. */
  deduped: boolean;
}

const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'files.db');
const UPLOADS_DIR = join(DATA_DIR, 'uploads');

const SELECT_COLUMNS = `
  original_name AS originalName,
  stored_name AS storedName,
  size,
  sha256,
  content_type AS contentType
`;

let dbInstance: Database.Database | undefined;

function getDb(): Database.Database {
  if (!dbInstance) {
    mkdirSync(DATA_DIR, { recursive: true });
    mkdirSync(UPLOADS_DIR, { recursive: true });

    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        size INTEGER NOT NULL,
        sha256 TEXT NOT NULL UNIQUE,
        content_type TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    dbInstance = db;
  }
  return dbInstance;
}

/**
 * Reduces a client-declared filename down to a safe base filename:
 *  - any directory components (using `/` or `\` as separators) are stripped,
 *    keeping only the last path segment.
 *  - bare `.` and `..` path segments are dropped, so path traversal never
 *    survives.
 *  - ASCII control characters are stripped.
 *  - all other characters, including non-ASCII/Unicode characters, are kept
 *    untouched.
 */
export function sanitizeFilename(rawName: string | null | undefined): string {
  const fallback = 'upload';
  if (!rawName || typeof rawName !== 'string') {
    return fallback;
  }

  const normalized = rawName.replace(/\\/g, '/');
  const segments = normalized
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..');

  let base = segments.length > 0 ? segments[segments.length - 1] : '';
  // Strip ASCII control characters (including NUL) while preserving every
  // other character, in particular any Unicode text.
  base = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();

  return base.length > 0 ? base : fallback;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

function matchesSignature(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

/** Detects PNG / PDF content purely from the byte signature, ignoring any
 * client-declared filename or content type. Returns `null` when the content
 * is not one of the accepted types. */
export function detectContentType(buffer: Buffer): ContentType | null {
  if (matchesSignature(buffer, PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (matchesSignature(buffer, PDF_SIGNATURE)) {
    return 'application/pdf';
  }
  return null;
}

function extensionFor(contentType: ContentType): string {
  return contentType === 'image/png' ? '.png' : '.pdf';
}

/**
 * Persists an accepted upload, deduplicating by content (SHA-256).
 *
 * The stored name is derived deterministically from the content hash, so
 * byte-identical uploads always resolve to the same stored name. The
 * check-then-write sequence below runs without any `await`, and all
 * `better-sqlite3` calls are synchronous/blocking, so within this single
 * Node.js process the whole operation is effectively atomic: two "concurrent"
 * requests for identical content can never both pass the "not found" check
 * before either one inserts. The `SQLITE_CONSTRAINT_UNIQUE` catch below is a
 * defense-in-depth safety net in case of any other, unforeseen race.
 */
export function saveUpload(
  buffer: Buffer,
  originalName: string,
  contentType: ContentType
): SaveUploadResult {
  const db = getDb();
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const storedName = `${sha256}${extensionFor(contentType)}`;

  const selectStmt = db.prepare<[string], StoredFileRecord>(
    `SELECT ${SELECT_COLUMNS} FROM files WHERE sha256 = ?`
  );

  const existing = selectStmt.get(sha256);
  if (existing) {
    return { file: existing, deduped: true };
  }

  const filePath = join(UPLOADS_DIR, storedName);
  if (!existsSync(filePath)) {
    writeFileSync(filePath, buffer);
  }

  let deduped = false;
  try {
    db.prepare(
      `INSERT INTO files (original_name, stored_name, size, sha256, content_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(originalName, storedName, buffer.length, sha256, contentType, Date.now());
  } catch (err) {
    if (err instanceof Database.SqliteError && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      // Another (concurrent) request already inserted this exact content.
      deduped = true;
    } else {
      throw err;
    }
  }

  const row = selectStmt.get(sha256);
  if (!row) {
    throw new Error('Failed to persist uploaded file metadata.');
  }
  return { file: row, deduped };
}

/** Lists all stored files, ordered by upload (insertion) order. */
export function listFiles(): StoredFileRecord[] {
  const db = getDb();
  return db.prepare<[], StoredFileRecord>(`SELECT ${SELECT_COLUMNS} FROM files ORDER BY id ASC`).all();
}

/** Looks up a stored file by its stored name. Rejects anything that isn't a
 * plain, filesystem-safe stored name outright (defense in depth). */
export function getFileByStoredName(storedName: string): StoredFileRecord | undefined {
  if (!storedName || /[\\/]/.test(storedName) || storedName.includes('..')) {
    return undefined;
  }
  const db = getDb();
  return db
    .prepare<[string], StoredFileRecord>(`SELECT ${SELECT_COLUMNS} FROM files WHERE stored_name = ?`)
    .get(storedName);
}

/** Absolute path on disk for a given stored name. */
export function getUploadFilePath(storedName: string): string {
  return join(UPLOADS_DIR, storedName);
}
