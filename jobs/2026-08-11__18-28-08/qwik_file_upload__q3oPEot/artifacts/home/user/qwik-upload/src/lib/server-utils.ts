import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const UPLOADS_DIR = '/home/user/qwik-upload/uploads';
const DB_PATH = '/home/user/qwik-upload/db.sqlite';

// Ensure uploads directory exists
mkdirSync(UPLOADS_DIR, { recursive: true });

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    originalName TEXT NOT NULL,
    storedName TEXT NOT NULL UNIQUE,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL UNIQUE,
    contentType TEXT NOT NULL
  )
`);

export interface FileMetadata {
  originalName: string;
  storedName: string;
  size: number;
  sha256: string;
  contentType: string;
}

function sanitizeFilename(filename: string): string {
  // Normalize backslashes to forward slashes
  let name = filename.replace(/\\/g, '/');
  // Get base name (last segment)
  const lastSlash = name.lastIndexOf('/');
  if (lastSlash !== -1) {
    name = name.substring(lastSlash + 1);
  }
  // Remove any '..' segments or '.' segments
  while (name.includes('..')) {
    name = name.replace(/\.\./g, '');
  }
  // If the name is empty or just '.', default to 'file'
  if (!name || name === '.') {
    name = 'file';
  }
  // Remove path separators if any are left
  name = name.replace(/[\/\\]/g, '');
  return name;
}

export async function handleUpload(
  file: unknown,
  clientFilename: unknown
): Promise<{ success: true; dedup: boolean } | { success: false; errorCode: 'no_file' | 'file_too_large' | 'unsupported_type' }> {
  // 1. Validate missing or empty file
  if (!file || !(file instanceof File) || file.size === 0) {
    return { success: false, errorCode: 'no_file' };
  }

  // 2. Validate file size (max 1048576 bytes)
  if (file.size > 1048576) {
    return { success: false, errorCode: 'file_too_large' };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > 1048576) {
    return { success: false, errorCode: 'file_too_large' };
  }

  // 3. Validate content type (PNG or PDF from actual byte signature)
  let contentType = '';
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    contentType = 'image/png';
  } else if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    contentType = 'application/pdf';
  } else {
    return { success: false, errorCode: 'unsupported_type' };
  }

  // 4. Sanitize original filename
  let rawFilename = typeof clientFilename === 'string' ? clientFilename : '';
  if (!rawFilename && file.name) {
    rawFilename = file.name;
  }
  const originalName = sanitizeFilename(rawFilename || 'file');

  // Compute SHA-256
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  // Stored name is identical for byte-identical content
  const ext = contentType === 'image/png' ? 'png' : 'pdf';
  const storedName = `${sha256}.${ext}`;

  // Check database first
  const existing = db.prepare('SELECT * FROM files WHERE sha256 = ?').get(sha256) as FileMetadata | undefined;
  if (existing) {
    return { success: true, dedup: true };
  }

  const filePath = join(UPLOADS_DIR, storedName);
  // Write file to uploads directory
  writeFileSync(filePath, buffer);

  try {
    // Insert into database
    db.prepare(`
      INSERT INTO files (originalName, storedName, size, sha256, contentType)
      VALUES (?, ?, ?, ?, ?)
    `).run(originalName, storedName, buffer.length, sha256, contentType);

    return { success: true, dedup: false };
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message?.includes('UNIQUE constraint failed')) {
      return { success: true, dedup: true };
    }
    throw err;
  }
}

export function getFiles(): FileMetadata[] {
  return db.prepare('SELECT originalName, storedName, size, sha256, contentType FROM files').all() as FileMetadata[];
}

export function getFileMetadata(storedName: string): FileMetadata | undefined {
  return db.prepare('SELECT originalName, storedName, size, sha256, contentType FROM files WHERE storedName = ?').get(storedName) as FileMetadata | undefined;
}

export function getFilePath(storedName: string): string {
  return join(UPLOADS_DIR, storedName);
}
