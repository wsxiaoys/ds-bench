import type { RequestHandler } from "@builder.io/qwik-city";
import db from "~/lib/db";
import { generateApiKey, hashApiKey } from "~/lib/crypto";

export const onPost: RequestHandler = async ({ request, json }) => {
  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    json(400, { error: "Invalid JSON body" });
    return;
  }

  if (!body || typeof body.name !== "string" || body.name.trim() === "") {
    json(400, { error: "Name is required and must be a non-empty string" });
    return;
  }

  const name = body.name.trim();
  const rawKey = generateApiKey();
  const prefix = rawKey.substring(0, 7);
  const hashedKey = hashApiKey(rawKey);
  const createdAt = new Date().toISOString();

  try {
    const stmt = db.prepare(`
      INSERT INTO api_keys (name, key_prefix, hashed_key, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, prefix, hashedKey, "active", createdAt);
    const id = Number(result.lastInsertRowid);

    json(201, {
      id,
      name,
      prefix,
      key: rawKey,
      status: "active",
      created_at: createdAt,
    });
  } catch (error: any) {
    json(500, { error: "Database error: " + error.message });
  }
};

export const onGet: RequestHandler = async ({ json }) => {
  try {
    const stmt = db.prepare(`
      SELECT id, name, key_prefix, status, created_at
      FROM api_keys
      ORDER BY id DESC
    `);
    const rows = stmt.all();

    const result = rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      prefix: row.key_prefix,
      status: row.status,
      created_at: row.created_at,
    }));

    json(200, result);
  } catch (error: any) {
    json(500, { error: "Database error: " + error.message });
  }
};
