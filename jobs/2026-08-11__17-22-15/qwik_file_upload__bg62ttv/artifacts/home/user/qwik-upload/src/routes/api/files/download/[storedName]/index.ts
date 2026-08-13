import { type RequestHandler } from '@builder.io/qwik-city';
import { getFileByStoredName, getUploadFilePath } from '../../../../../lib/db.server';
import { Readable } from 'node:stream';
import * as fs from 'node:fs';

export const onGet: RequestHandler = async (event) => {
  const storedName = event.params.storedName;
  const file = getFileByStoredName(storedName);

  if (!file) {
    event.status(404);
    event.json(404, { error: 'File not found' });
    return;
  }

  const filePath = getUploadFilePath(storedName);
  if (!fs.existsSync(filePath)) {
    event.status(404);
    event.json(404, { error: 'File not found on disk' });
    return;
  }

  const nodeStream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream);

  const response = new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.originalName}"`,
    },
  });

  event.send(response);
};
