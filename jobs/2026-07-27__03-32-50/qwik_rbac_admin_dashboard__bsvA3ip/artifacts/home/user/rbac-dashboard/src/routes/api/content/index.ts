import type { RequestHandler } from '@builder.io/qwik-city';
import type { SessionUser } from '~/lib/auth';
import { createContent, listContent } from '~/lib/db';

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const onGet: RequestHandler = async (requestEvent) => {
  const user = requestEvent.sharedMap.get('user') as SessionUser | null;

  if (!user) {
    requestEvent.json(401, { error: 'Authentication required' });
    return;
  }

  requestEvent.json(200, listContent());
};

export const onPost: RequestHandler = async (requestEvent) => {
  const user = requestEvent.sharedMap.get('user') as SessionUser | null;

  if (!user) {
    requestEvent.json(401, { error: 'Authentication required' });
    return;
  }

  if (user.role !== 'editor' && user.role !== 'admin') {
    requestEvent.json(403, { error: 'Forbidden: editor or admin role required' });
    return;
  }

  const body = await readJsonBody(requestEvent.request);
  const title = typeof body.title === 'string' ? body.title : '';
  const contentBody = typeof body.body === 'string' ? body.body : '';

  // The client-supplied `id` (if any) is intentionally ignored; the
  // database always assigns the id.
  const created = createContent(title, contentBody);

  requestEvent.json(201, created);
};
