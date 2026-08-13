import type { RequestHandler } from "@builder.io/qwik-city";
import { publishMessage } from "~/lib/chat";

export const onPost: RequestHandler = async (ev) => {
  const { params, json, parseBody } = ev;
  const room = params.room;

  // Validate room parameter
  if (!room || !/^[A-Za-z0-9_-]+$/.test(room)) {
    json(400, { error: "Invalid room name" });
    return;
  }

  let body: any;
  try {
    body = await parseBody();
  } catch {
    json(400, { error: "Malformed JSON body" });
    return;
  }

  if (!body || typeof body !== 'object') {
    json(400, { error: "Invalid JSON body" });
    return;
  }

  const { user, text } = body;

  if (typeof user !== 'string' || typeof text !== 'string') {
    json(400, { error: "Fields 'user' and 'text' must be strings" });
    return;
  }

  const trimmedUser = user.trim();
  const trimmedText = text.trim();

  if (trimmedUser.length < 1 || trimmedUser.length > 64) {
    json(400, { error: "Field 'user' must be 1 to 64 characters long after trimming" });
    return;
  }

  if (trimmedText.length < 1 || trimmedText.length > 2000) {
    json(400, { error: "Field 'text' must be 1 to 2000 characters long after trimming" });
    return;
  }

  const msg = publishMessage(room, trimmedUser, trimmedText);

  json(201, {
    room: msg.room,
    seq: msg.seq,
    user: msg.user,
    text: msg.text,
    ts: msg.ts
  });
};
