import type { RequestHandler } from "@builder.io/qwik-city";
import { getDb } from "../../db";

export const onPost: RequestHandler = async ({ parseBody, json }) => {
  let body: any;
  try {
    body = await parseBody();
  } catch (error) {
    json(400, { error: "Title and content are required" });
    return;
  }

  if (
    !body ||
    typeof body !== "object" ||
    !body.title ||
    !body.content ||
    typeof body.title !== "string" ||
    typeof body.content !== "string" ||
    body.title.trim() === "" ||
    body.content.trim() === ""
  ) {
    json(400, { error: "Title and content are required" });
    return;
  }

  try {
    const db = getDb();
    const stmt = db.prepare("INSERT INTO articles_fts (title, content) VALUES (?, ?)");
    const info = stmt.run(body.title, body.content);
    const rowid = Number(info.lastInsertRowid);

    json(201, {
      rowid,
      title: body.title,
      content: body.content,
    });
  } catch (error) {
    json(400, { error: "Title and content are required" });
  }
};
