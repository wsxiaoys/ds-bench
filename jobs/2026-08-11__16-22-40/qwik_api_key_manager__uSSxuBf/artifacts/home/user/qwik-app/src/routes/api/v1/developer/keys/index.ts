import type { RequestHandler } from '@builder.io/qwik-city';
import db from '../../../../../lib/db';
import { generateApiKey, hashKey } from '../../../../../lib/keys';

export const onPost: RequestHandler = async (event) => {
  try {
    const body = await event.parseBody() as any;
    if (!body || typeof body !== 'object') {
      event.json(400, { error: 'Invalid request body' });
      return;
    }

    const { name } = body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      event.json(400, { error: 'Name is required and must be a non-empty string' });
      return;
    }

    const trimmedName = name.trim();
    const plainTextKey = generateApiKey();
    const prefix = plainTextKey.substring(0, 7);
    const hashed = hashKey(plainTextKey);
    const status = 'active';
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO api_keys (name, key_prefix, hashed_key, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(trimmedName, prefix, hashed, status, createdAt);
    const id = Number(result.lastInsertRowid);

    event.json(201, {
      id,
      name: trimmedName,
      prefix,
      key: plainTextKey,
      status,
      created_at: createdAt
    });
  } catch (err: any) {
    console.error('Error in POST /api/v1/developer/keys:', err);
    event.json(500, { error: 'Internal server error' });
  }
};

export const onGet: RequestHandler = async (event) => {
  try {
    const stmt = db.prepare(`
      SELECT id, name, key_prefix AS prefix, status, created_at
      FROM api_keys
      ORDER BY id DESC
    `);
    const keys = stmt.all();
    event.json(200, keys);
  } catch (err: any) {
    console.error('Error in GET /api/v1/developer/keys:', err);
    event.json(500, { error: 'Internal server error' });
  }
};
