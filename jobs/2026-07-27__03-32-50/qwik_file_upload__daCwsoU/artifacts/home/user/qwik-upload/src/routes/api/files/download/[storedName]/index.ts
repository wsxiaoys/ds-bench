import type { RequestHandler } from '@builder.io/qwik-city';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { getFileByStoredName, getUploadFilePath } from '../../../../../lib/storage';

export const onGet: RequestHandler = async (requestEvent) => {
  const { storedName } = requestEvent.params;
  const record = getFileByStoredName(storedName);

  if (!record) {
    throw requestEvent.error(404, 'File not found');
  }

  const filePath = getUploadFilePath(record.storedName);
  const webStream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;

  requestEvent.send(
    new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': record.contentType,
        'Content-Disposition': `attachment; filename="${record.originalName}"`,
      },
    })
  );
};
