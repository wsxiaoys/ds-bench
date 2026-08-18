import type { RequestHandler } from '@builder.io/qwik-city';
import db from '../../../../../../../lib/db';

export const onPost: RequestHandler = async (event) => {
  try {
    const { id } = event.params;
    const keyId = Number(id);

    if (isNaN(keyId)) {
      event.json(400, { error: 'Invalid key ID' });
      return;
    }

    // Check if the key exists
    const keyExists = db.prepare('SELECT id FROM api_keys WHERE id = ?').get(keyId);
    if (!keyExists) {
      event.json(404, { error: 'Key not found' });
      return;
    }

    // Update status to 'revoked'
    db.prepare("UPDATE api_keys SET status = 'revoked' WHERE id = ?").run(keyId);

    event.json(200, {
      success: true,
      message: 'API key has been successfully revoked'
    });
  } catch (err: any) {
    console.error('Error in POST /api/v1/developer/keys/:id/revoke:', err);
    event.json(500, { error: 'Internal server error' });
  }
};
