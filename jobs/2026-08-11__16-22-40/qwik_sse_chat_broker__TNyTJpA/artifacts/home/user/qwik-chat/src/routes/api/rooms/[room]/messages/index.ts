import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '~/lib/db';
import { broker } from '~/lib/broker';
import type { Message } from '~/lib/types';

export const onPost: RequestHandler = async ({ params, parseBody, json }) => {
  const room = params.room;
  if (!room || !/^[A-Za-z0-9_-]+$/.test(room)) {
    json(400, { error: "Invalid room name" });
    return;
  }

  let body: any;
  try {
    body = await parseBody();
  } catch (err) {
    json(400, { error: "Malformed JSON body" });
    return;
  }

  if (!body || typeof body !== 'object') {
    json(400, { error: "Invalid request body" });
    return;
  }

  if (!('user' in body) || !('text' in body)) {
    json(400, { error: "Missing required fields: user and text are required" });
    return;
  }

  if (typeof body.user !== 'string' || typeof body.text !== 'string') {
    json(400, { error: "Fields user and text must be strings" });
    return;
  }

  const user = body.user.trim();
  const text = body.text.trim();

  if (user.length < 1 || user.length > 64) {
    json(400, { error: "User length must be between 1 and 64 characters after trimming" });
    return;
  }

  if (text.length < 1 || text.length > 2000) {
    json(400, { error: "Text length must be between 1 and 2000 characters after trimming" });
    return;
  }

  const ts = Date.now();

  try {
    // Perform database operations in a transaction to ensure atomicity and gapless sequences
    const insertTx = db.transaction((r: string, u: string, t: string, timestamp: number): Message => {
      const row = db.prepare('SELECT MAX(seq) AS maxSeq FROM messages WHERE room = ?').get(r) as { maxSeq: number | null } | undefined;
      const nextSeq = (row?.maxSeq ?? 0) + 1;
      db.prepare('INSERT INTO messages (room, seq, user, text, ts) VALUES (?, ?, ?, ?, ?)').run(r, nextSeq, u, t, timestamp);
      return { room: r, seq: nextSeq, user: u, text: t, ts: timestamp };
    });

    const message = insertTx(room, user, text, ts);

    // Publish to the live subscribers
    broker.publish(message);

    json(201, message);
  } catch (err: any) {
    json(500, { error: err.message || "Failed to persist and broadcast message" });
  }
};
