import { type RequestHandler } from '@builder.io/qwik-city';
import { getBookmarks, createBookmark } from '../../../lib/db';

export const onGet: RequestHandler = async ({ json, query }) => {
  const tags = query.getAll('tag').map(t => t.trim()).filter(Boolean);
  const bookmarks = getBookmarks(tags);
  json(200, bookmarks);
};

export const onPost: RequestHandler = async ({ json, parseBody }) => {
  const body = await parseBody() as any;
  if (!body || typeof body !== 'object') {
    json(400, { error: 'Invalid body' });
    return;
  }
  const { url, title, tags } = body;
  if (!url || typeof url !== 'string' || url.trim() === '' ||
      !title || typeof title !== 'string' || title.trim() === '') {
    json(400, { error: 'URL and Title are required' });
    return;
  }
  const tagsArray = Array.isArray(tags) ? tags : [];
  try {
    const bookmark = createBookmark(url, title, tagsArray);
    json(201, bookmark);
  } catch (err: any) {
    json(400, { error: err.message });
  }
};
