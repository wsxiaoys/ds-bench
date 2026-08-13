import type { RequestHandler } from "@builder.io/qwik-city";
import { getDb } from "../../db";

export const onGet: RequestHandler = async ({ query, json }) => {
  const q = query.get("q");

  if (!q || q.trim() === "") {
    json(200, []);
    return;
  }

  try {
    const db = getDb();
    const stmt = db.prepare(
      `SELECT title, snippet(articles_fts, 1, '<b>', '</b>', '...', 10) as snippet 
       FROM articles_fts 
       WHERE articles_fts MATCH ?`
    );
    const results = stmt.all(q) as { title: string; snippet: string }[];
    json(200, results);
  } catch (error) {
    json(400, { error: "Invalid search query syntax" });
  }
};
