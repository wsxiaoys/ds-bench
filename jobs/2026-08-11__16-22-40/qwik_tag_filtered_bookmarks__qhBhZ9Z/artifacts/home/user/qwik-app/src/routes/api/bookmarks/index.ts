import type { RequestHandler } from "@builder.io/qwik-city";
import { getBookmarks, addBookmark } from "../../../bookmarkService";

export const onGet: RequestHandler = async ({ url, json }) => {
  try {
    const tags = url.searchParams.getAll("tag");
    const bookmarks = getBookmarks(tags);
    json(200, bookmarks);
  } catch (error: any) {
    json(500, { error: error?.message || "Internal Server Error" });
  }
};

export const onPost: RequestHandler = async ({ request, json }) => {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch (e) {
      json(400, { error: "Invalid JSON body" });
      return;
    }

    if (!body || typeof body !== "object") {
      json(400, { error: "Invalid request body" });
      return;
    }

    const { url: bookmarkUrl, title, tags } = body;

    if (
      typeof bookmarkUrl !== "string" ||
      typeof title !== "string" ||
      !bookmarkUrl.trim() ||
      !title.trim()
    ) {
      json(400, { error: "Missing or empty url or title" });
      return;
    }

    const tagsArray = Array.isArray(tags) ? tags.map((t) => String(t)) : [];

    const created = addBookmark(bookmarkUrl.trim(), title.trim(), tagsArray);
    json(201, created);
  } catch (error: any) {
    json(500, { error: error?.message || "Internal Server Error" });
  }
};
