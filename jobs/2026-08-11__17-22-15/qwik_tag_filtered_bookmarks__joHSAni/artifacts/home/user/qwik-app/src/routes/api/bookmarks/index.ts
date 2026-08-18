import { type RequestHandler } from "@builder.io/qwik-city";
import { getBookmarks, insertBookmarkWithTags } from "../../../lib/db";

export const onGet: RequestHandler = async ({ url, json }) => {
  try {
    const filterTags = url.searchParams.getAll("tag");
    const bookmarks = getBookmarks(filterTags);
    json(200, bookmarks);
  } catch (error: any) {
    json(500, { error: error.message || "Internal Server Error" });
  }
};

export const onPost: RequestHandler = async ({ request, json }) => {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      json(400, { error: "Invalid JSON body" });
      return;
    }

    if (!body || typeof body !== "object") {
      json(400, { error: "Invalid body" });
      return;
    }

    const { url, title, tags } = body;

    if (
      typeof url !== "string" ||
      url.trim() === "" ||
      typeof title !== "string" ||
      title.trim() === ""
    ) {
      json(400, { error: "url and title are required and must be non-empty strings" });
      return;
    }

    const tagArray: string[] = [];
    if (Array.isArray(tags)) {
      for (const t of tags) {
        if (typeof t === "string") {
          tagArray.push(t);
        }
      }
    }

    const createdBookmark = insertBookmarkWithTags(url.trim(), title.trim(), tagArray);
    json(201, createdBookmark);
  } catch (error: any) {
    json(500, { error: error.message || "Internal Server Error" });
  }
};
