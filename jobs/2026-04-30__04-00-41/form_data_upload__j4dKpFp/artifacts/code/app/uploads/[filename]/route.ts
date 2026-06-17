import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Serve files that were saved at runtime to `public/uploads/`.
 *
 * Next.js's static file server only knows about files present in `public/`
 * at build time, so we expose a small dynamic route handler to read the
 * uploaded files from disk on demand.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;

  // Prevent any path traversal and reject hidden files.
  const safe = path.basename(filename);
  if (!safe || safe.startsWith('.')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const filePath = path.join(UPLOAD_DIR, safe);
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(safe).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.byteLength),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
