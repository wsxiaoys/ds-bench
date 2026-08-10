import type { RequestHandler } from "@builder.io/qwik-city";
import { createBookmark, listBookmarks } from "~/lib/db";

export const onGet: RequestHandler = async (requestEvent) => {
  const tags = requestEvent.url.searchParams.getAll("tag");
  const bookmarks = listBookmarks(tags);
  requestEvent.json(200, bookmarks);
};

export const onPost: RequestHandler = async (requestEvent) => {
  let body: unknown;
  try {
    body = await requestEvent.parseBody();
  } catch {
    requestEvent.json(400, { error: "Invalid JSON body" });
    return;
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("url" in body) ||
    !("title" in body)
  ) {
    requestEvent.json(400, { error: "Missing required fields" });
    return;
  }

  const { url, title, tags } = body as {
    url?: unknown;
    title?: unknown;
    tags?: unknown;
  };

  if (
    typeof url !== "string" ||
    url.trim().length === 0 ||
    typeof title !== "string" ||
    title.trim().length === 0
  ) {
    requestEvent.json(400, { error: "url and title are required" });
    return;
  }

  const tagNames = Array.isArray(tags)
    ? tags.filter((t): t is string => typeof t === "string")
    : [];

  const bookmark = createBookmark(url, title, tagNames);
  requestEvent.json(201, bookmark);
};
