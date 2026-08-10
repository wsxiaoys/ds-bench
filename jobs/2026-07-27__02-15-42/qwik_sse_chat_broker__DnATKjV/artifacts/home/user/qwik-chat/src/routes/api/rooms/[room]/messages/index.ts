import type { RequestHandler } from "@builder.io/qwik-city";
import { db, broker } from "../../../../../lib/state";

export const onPost: RequestHandler = async (requestEvent) => {
  const room = requestEvent.params.room;
  if (!room || !/^[A-Za-z0-9_-]+$/.test(room)) {
    requestEvent.json(400, { error: "Invalid room name" });
    return;
  }

  let body: any;
  try {
    body = await requestEvent.request.json();
  } catch {
    requestEvent.json(400, { error: "Malformed or missing JSON body" });
    return;
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    requestEvent.json(400, { error: "Request body must be a JSON object" });
    return;
  }

  if (typeof body.user !== "string") {
    requestEvent.json(400, { error: "User must be a string" });
    return;
  }

  if (typeof body.text !== "string") {
    requestEvent.json(400, { error: "Text must be a string" });
    return;
  }

  const trimmedUser = body.user.trim();
  const trimmedText = body.text.trim();

  if (trimmedUser.length < 1 || trimmedUser.length > 64) {
    requestEvent.json(400, { error: "User must be between 1 and 64 characters" });
    return;
  }

  if (trimmedText.length < 1 || trimmedText.length > 2000) {
    requestEvent.json(400, { error: "Text must be between 1 and 2000 characters" });
    return;
  }

  const ts = Date.now();
  let seq: number;

  try {
    const result = db.transaction(() => {
      const insertStmt = db.prepare(`
        INSERT INTO messages (room, seq, user, text, ts)
        VALUES (
          ?,
          (SELECT COALESCE(MAX(seq), 0) + 1 FROM messages WHERE room = ?),
          ?,
          ?,
          ?
        )
        RETURNING seq
      `);
      return insertStmt.get(room, room, trimmedUser, trimmedText, ts) as { seq: number };
    })();
    seq = result.seq;
  } catch (err: any) {
    requestEvent.json(500, { error: err.message || "Database error" });
    return;
  }

  const message = {
    room,
    seq,
    user: trimmedUser,
    text: trimmedText,
    ts,
  };

  broker.publish(room, message);

  requestEvent.json(201, {
    room: message.room,
    seq: message.seq,
    user: message.user,
    text: message.text,
    ts: message.ts,
  });
};
