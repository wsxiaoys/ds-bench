import type { RequestHandler } from '@builder.io/qwik-city';
import { existsSync, readFileSync } from 'node:fs';

export const onGet: RequestHandler = async ({ params, status, headers, send }) => {
  const { storedName } = params;
  const { getFileByStoredName, getFilePath } = await import('../../../../../lib/storage');

  const file = getFileByStoredName(storedName);
  if (!file) {
    status(404);
    send(404, 'File not found');
    return;
  }

  const filePath = getFilePath(storedName);
  if (!existsSync(filePath)) {
    status(404);
    send(404, 'File content not found on disk');
    return;
  }

  try {
    const buffer = readFileSync(filePath);
    headers.set('Content-Type', file.contentType);
    headers.set('Content-Disposition', `attachment; filename="${file.originalName}"`);
    send(200, buffer);
  } catch (err) {
    console.error('Download error:', err);
    status(500);
    send(500, 'Internal server error');
  }
};
