import type { RequestHandler } from '@builder.io/qwik-city';
import type { SessionUser } from '~/lib/auth';
import { deleteContent } from '~/lib/db';

export const onDelete: RequestHandler = async (requestEvent) => {
  const user = requestEvent.sharedMap.get('user') as SessionUser | null;

  if (!user) {
    requestEvent.json(401, { error: 'Authentication required' });
    return;
  }

  if (user.role !== 'editor' && user.role !== 'admin') {
    requestEvent.json(403, { error: 'Forbidden: editor or admin role required' });
    return;
  }

  const id = Number(requestEvent.params.id);

  if (!Number.isInteger(id)) {
    requestEvent.json(404, { error: 'Not found' });
    return;
  }

  const deleted = deleteContent(id);

  if (!deleted) {
    requestEvent.json(404, { error: 'Not found' });
    return;
  }

  requestEvent.json(200, { success: true });
};
