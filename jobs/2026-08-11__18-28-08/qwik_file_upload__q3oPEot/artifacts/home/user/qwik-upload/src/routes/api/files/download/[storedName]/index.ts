import type { RequestHandler } from '@builder.io/qwik-city';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

export const onGet: RequestHandler = async (requestEvent) => {
  const storedName = requestEvent.params.storedName;
  const { getFileMetadata, getFilePath } = await import('../../../../../lib/server-utils');

  const file = getFileMetadata(storedName);
  if (!file) {
    requestEvent.status(404);
    requestEvent.send(404, 'File not found');
    return;
  }

  const filePath = getFilePath(storedName);

  // Set headers
  requestEvent.headers.set('Content-Type', file.contentType);
  // Encode filename to preserve Unicode and prevent issues
  const encodedFilename = encodeURIComponent(file.originalName);
  requestEvent.headers.set(
    'Content-Disposition',
    `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
  );

  // Stream the file back
  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream);

  const response = new Response(webStream, {
    status: 200,
  });

  requestEvent.send(response);
};
