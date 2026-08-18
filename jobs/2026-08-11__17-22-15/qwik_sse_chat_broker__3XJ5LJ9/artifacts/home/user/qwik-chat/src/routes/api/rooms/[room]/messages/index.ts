import type { RequestHandler } from "@builder.io/qwik-city";
import { db, broker } from "../../../../../lib/db";

export const onPost: RequestHandler = async (event) => {
  const { params, parseBody, json } = event;

  // 1. Validate room parameter
  const room = params.room;
  const roomRegex = /^[A-Za-z0-9_-]+$/;
  if (!room || !roomRegex.test(room)) {
    json(400, { error: "Invalid room name" });
    return;
  }

  // 2. Parse and validate body
  let body: any;
  try {
    body = await parseBody();
  } catch {
    json(400, { error: "Malformed JSON body" });
    return;
  }

  if (!body || typeof body !== "object") {
    json(400, { error: "Request body must be a JSON object" });
    return;
  }

  const { user, text } = body;
  if (typeof user !== "string" || typeof text !== "string") {
    json(400, { error: "user and text must be strings" });
    return;
  }

  const trimmedUser = user.trim();
  const trimmedText = text.trim();

  if (trimmedUser.length < 1 || trimmedUser.length > 64) {
    json(400, { error: "user must be between 1 and 64 characters after trimming" });
    return;
  }

  if (trimmedText.length < 1 || trimmedText.length > 2000) {
    json(400, { error: "text must be between 1 and 2000 characters after trimming" });
    return;
  }

  // 3. Assign seq and ts atomically, persist to SQLite
  const ts = Date.now();
  let seq: number;

  try {
    const insertTx = db.transaction(() => {
      const row = db.prepare(
        "SELECT COALESCE(MAX(seq), 0) + 1 AS nextSeq FROM messages WHERE room = ?"
      ).get(room) as { nextSeq: number };
      const nextSeq = row.nextSeq;

      db.prepare(
        "INSERT INTO messages (room, seq, user, text, ts) VALUES (?, ?, ?, ?, ?)"
      ).run(room, nextSeq, trimmedUser, trimmedText, ts);

      return nextSeq;
    });

    seq = insertTx();
  } catch (err: any) {
    json(500, { error: err.message || "Failed to persist message" });
    return;
  }

  // 4. Construct message object containing exactly the required keys
  const message = {
    room,
    seq,
    user: trimmedUser,
    text: trimmedText,
    ts,
  };

  // 5. Broadcast to live subscribers
  broker.publish(room, message);

  // 6. Respond HTTP 201
  json(201, message);
};
