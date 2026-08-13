import type { RequestHandler } from "@builder.io/qwik-city";
import db from "~/lib/db";
import { hashApiKey } from "~/lib/crypto";

export const onGet: RequestHandler = async ({ request, headers, json }) => {
  const apiKey = headers.get("X-API-Key") || request.headers.get("X-API-Key");

  if (!apiKey) {
    json(401, { error: "Unauthorized" });
    return;
  }

  if (!apiKey.startsWith("qk_") || apiKey.length !== 35) {
    json(401, { error: "Unauthorized" });
    return;
  }

  const prefix = apiKey.substring(0, 7);
  const hashedKey = hashApiKey(apiKey);

  try {
    const stmt = db.prepare(`
      SELECT id FROM api_keys
      WHERE key_prefix = ? AND hashed_key = ? AND status = 'active'
    `);
    const row = stmt.get(prefix, hashedKey);

    if (!row) {
      json(401, { error: "Unauthorized" });
      return;
    }

    json(200, {
      message: "Hello, authenticated developer!",
    });
  } catch (error: any) {
    json(500, { error: "Database error: " + error.message });
  }
};
