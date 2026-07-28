import type { RequestHandler } from "@builder.io/qwik-city";
import { insertMessage } from "~/lib/db";
import { broker } from "~/lib/broker";

const MIN_USER_LEN = 1;
const MAX_USER_LEN = 64;
const MIN_TEXT_LEN = 1;
const MAX_TEXT_LEN = 2000;

export const onPost: RequestHandler = async (ev) => {
  const room = ev.params.room;

  let body: unknown;
  try {
    body = await ev.request.json();
  } catch {
    ev.json(400, { error: "Request body must be valid JSON" });
    return;
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    ev.json(400, { error: "Request body must be a JSON object" });
    return;
  }

  const rawUser = (body as Record<string, unknown>).user;
  const rawText = (body as Record<string, unknown>).text;

  if (typeof rawUser !== "string") {
    ev.json(400, { error: "'user' is required and must be a string" });
    return;
  }
  if (typeof rawText !== "string") {
    ev.json(400, { error: "'text' is required and must be a string" });
    return;
  }

  const user = rawUser.trim();
  const text = rawText.trim();

  if (user.length < MIN_USER_LEN || user.length > MAX_USER_LEN) {
    ev.json(400, {
      error: `'user' must be between ${MIN_USER_LEN} and ${MAX_USER_LEN} characters after trimming`,
    });
    return;
  }

  if (text.length < MIN_TEXT_LEN || text.length > MAX_TEXT_LEN) {
    ev.json(400, {
      error: `'text' must be between ${MIN_TEXT_LEN} and ${MAX_TEXT_LEN} characters after trimming`,
    });
    return;
  }

  const ts = Date.now();
  const message = insertMessage(room, user, text, ts);

  broker.publish(room, message);

  ev.json(201, message);
};
