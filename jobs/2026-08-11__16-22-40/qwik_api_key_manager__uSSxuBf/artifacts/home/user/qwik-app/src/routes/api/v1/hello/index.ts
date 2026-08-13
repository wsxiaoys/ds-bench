import type { RequestHandler } from '@builder.io/qwik-city';
import db from '../../../../lib/db';
import { hashKey } from '../../../../lib/keys';

export const onGet: RequestHandler = async (event) => {
  try {
    const apiKey = event.request.headers.get('x-api-key');
    if (!apiKey) {
      event.json(401, { error: 'Unauthorized' });
      return;
    }

    const hashed = hashKey(apiKey);
    const keyRecord = db.prepare(`
      SELECT status FROM api_keys WHERE hashed_key = ?
    `).get(hashed) as { status: string } | undefined;

    if (!keyRecord || keyRecord.status !== 'active') {
      event.json(401, { error: 'Unauthorized' });
      return;
    }

    event.json(200, {
      message: 'Hello, authenticated developer!'
    });
  } catch (err: any) {
    console.error('Error in GET /api/v1/hello:', err);
    event.json(500, { error: 'Internal server error' });
  }
};
