import type { RequestHandler } from "@builder.io/qwik-city";
import { db, generateApiKey } from "~/lib/db";

export const onPost: RequestHandler = async (event) => {
  try {
    const body = (await event.parseBody()) as { name?: string } | null;
    const name = body?.name;

    if (!name || typeof name !== "string" || name.trim() === "") {
      event.json(400, { error: "Name is required and must be a non-empty string" });
      return;
    }

    const { key, prefix, hashedKey } = generateApiKey();
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO api_keys (name, key_prefix, hashed_key, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name.trim(), prefix, hashedKey, "active", createdAt);
    const id = Number(result.lastInsertRowid);

    event.json(201, {
      id,
      name: name.trim(),
      prefix,
      key,
      status: "active",
      created_at: createdAt,
    });
  } catch (error: any) {
    event.json(500, { error: error?.message || "Internal Server Error" });
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
  } catch (error: any) {
    event.json(500, { error: error?.message || "Internal Server Error" });
  }
};
