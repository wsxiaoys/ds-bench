import type { RequestHandler } from '@builder.io/qwik-city';
import { getBookmarks, createBookmark } from '../../../db';

export const onGet: RequestHandler = async ({ url, json }) => {
  const tags = url.searchParams.getAll('tag');
  const bookmarks = getBookmarks(tags);
  json(200, bookmarks);
};

export const onPost: RequestHandler = async ({ request, json }) => {
  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    json(400, { error: 'Invalid JSON body' });
    return;
  }

  if (!body) {
    json(400, { error: 'Body is required' });
    return;
  }

  const { url, title, tags } = body;

  if (typeof url !== 'string' || url.trim() === '') {
    json(400, { error: 'url is required and cannot be empty' });
    return;
  }

  if (typeof title !== 'string' || title.trim() === '') {
    json(400, { error: 'title is required and cannot be empty' });
    return;
  }

  let tagsArray: string[] = [];
  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      json(400, { error: 'tags must be an array of strings' });
      return;
    }
    tagsArray = tags.map(t => String(t));
  }

  try {
    const bookmark = createBookmark(url, title, tagsArray);
    json(201, bookmark);
  } catch (e: any) {
    json(500, { error: e.message || 'Internal server error' });
  }
};
