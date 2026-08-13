import type { RequestHandler } from "@builder.io/qwik-city";
import { db } from "../../db";

export const onPost: RequestHandler = async ({ json, parseBody }) => {
  const body = (await parseBody()) as { title?: string; content?: string } | null;

  if (!body || typeof body !== "object") {
    json(400, { error: "Title and content are required" });
    return;
  }

  const { title, content } = body;

  if (
    typeof title !== "string" ||
    typeof content !== "string" ||
    title.trim() === "" ||
    content.trim() === ""
  ) {
    json(400, { error: "Title and content are required" });
    return;
  }

  try {
    const stmt = db.prepare("INSERT INTO articles_fts (title, content) VALUES (?, ?)");
    const result = stmt.run(title, content);

    json(201, {
      rowid: Number(result.lastInsertRowid),
      title,
      content,
    });
  } catch (err) {
    json(500, { error: "Database error" });
  }
};
