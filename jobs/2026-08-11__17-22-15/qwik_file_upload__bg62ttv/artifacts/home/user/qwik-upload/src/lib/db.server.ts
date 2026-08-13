import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const PROJECT_ROOT = '/home/user/qwik-upload';
const DB_PATH = path.join(PROJECT_ROOT, 'uploads.db');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Initialize SQLite database
const db = new Database(DB_PATH);

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    originalName TEXT NOT NULL,
    storedName TEXT NOT NULL UNIQUE,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL UNIQUE,
    contentType TEXT NOT NULL
  );
`);

export interface FileMetadata {
  id?: number;
  originalName: string;
  storedName: string;
  size: number;
  sha256: string;
  contentType: string;
}

export function sanitizeFilename(name: string): string {
  if (!name) return 'file';
  // Replace backslashes with forward slashes to normalize
  const normalized = name.replace(/\\/g, '/');
  // Get the last portion after the last slash
  let base = normalized.split('/').pop() || '';
  if (base === '.' || base === '..' || !base) {
    base = 'file';
  }
  return base;
}

export function detectContentType(buffer: Buffer): 'image/png' | 'application/pdf' | null {
  if (buffer.length >= 8) {
    const isPng = buffer[0] === 0x89 &&
                  buffer[1] === 0x50 &&
                  buffer[2] === 0x4E &&
                  buffer[3] === 0x47 &&
                  buffer[4] === 0x0D &&
                  buffer[5] === 0x0A &&
                  buffer[6] === 0x1A &&
                  buffer[7] === 0x0A;
    if (isPng) return 'image/png';
  }
  if (buffer.length >= 4) {
    const isPdf = buffer[0] === 0x25 &&
                  buffer[1] === 0x50 &&
                  buffer[2] === 0x44 &&
                  buffer[3] === 0x46;
    if (isPdf) return 'application/pdf';
  }
  return null;
}

export function getAllFiles(): FileMetadata[] {
  return db.prepare('SELECT originalName, storedName, size, sha256, contentType FROM files ORDER BY id DESC').all() as FileMetadata[];
}

export function getFileByStoredName(storedName: string): FileMetadata | null {
  return db.prepare('SELECT originalName, storedName, size, sha256, contentType FROM files WHERE storedName = ?').get(storedName) as FileMetadata | null;
}

export interface UploadResult {
  success: boolean;
  errorCode?: 'no_file' | 'file_too_large' | 'unsupported_type';
  dedup?: boolean;
  file?: FileMetadata;
}

export async function processUpload(
  fileData: Blob | File | null | undefined,
  clientFilename: string | null | undefined
): Promise<UploadResult> {
  // 1. Validate missing or empty file
  if (!fileData || fileData.size === 0) {
    return { success: false, errorCode: 'no_file' };
  }

  // 2. Validate size (max 1048576 bytes)
  const MAX_SIZE = 1048576;
  if (fileData.size > MAX_SIZE) {
    return { success: false, errorCode: 'file_too_large' };
  }

  // Read file data into buffer
  const arrayBuffer = await fileData.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 3. Validate content type from byte signature
  const contentType = detectContentType(buffer);
  if (!contentType) {
    return { success: false, errorCode: 'unsupported_type' };
  }

  // 4. Sanitize client-declared filename
  const rawFilename = clientFilename || (fileData as any).name || 'file';
  const originalName = sanitizeFilename(rawFilename);

  // Compute SHA-256
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  // Determine server-generated stored name
  const ext = contentType === 'image/png' ? 'png' : 'pdf';
  const storedName = `${sha256}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, storedName);

  // 5. Deduplicate by content
  // Check if it already exists in the database
  const existing = db.prepare('SELECT originalName, storedName, size, sha256, contentType FROM files WHERE sha256 = ?').get(sha256) as FileMetadata | null;
  if (existing) {
    return { success: true, dedup: true, file: existing };
  }

  // Write file to disk
  await fs.promises.writeFile(filePath, buffer);

  // Insert into DB
  try {
    db.prepare(`
      INSERT INTO files (originalName, storedName, size, sha256, contentType)
      VALUES (?, ?, ?, ?, ?)
    `).run(originalName, storedName, buffer.length, sha256, contentType);

    const inserted = {
      originalName,
      storedName,
      size: buffer.length,
      sha256,
      contentType
    };

    return { success: true, dedup: false, file: inserted };
  } catch (err: any) {
    // If concurrent request inserted it first, handle unique constraint
    if (err.code === 'SQLITE_CONSTRAINT' || err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const concurrentExisting = db.prepare('SELECT originalName, storedName, size, sha256, contentType FROM files WHERE sha256 = ?').get(sha256) as FileMetadata | null;
      if (concurrentExisting) {
        return { success: true, dedup: true, file: concurrentExisting };
      }
    }
    throw err;
  }
}

export function getUploadFilePath(storedName: string): string {
  return path.join(UPLOADS_DIR, storedName);
}
