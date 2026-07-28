import type { RequestHandler } from '@builder.io/qwik-city';
import type { SessionUser } from '~/lib/auth';
import { createUser, listUsers, type Role } from '~/lib/db';

const VALID_ROLES: Role[] = ['admin', 'editor', 'viewer'];

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

  if (user.role !== 'admin') {
    requestEvent.json(403, { error: 'Forbidden: admin role required' });
    return;
  }

  // listUsers() never selects the password hash/salt columns.
  requestEvent.json(200, listUsers());
};

export const onPost: RequestHandler = async (requestEvent) => {
  const user = requestEvent.sharedMap.get('user') as SessionUser | null;

  if (!user) {
    requestEvent.json(401, { error: 'Authentication required' });
    return;
  }

  if (user.role !== 'admin') {
    requestEvent.json(403, { error: 'Forbidden: admin role required' });
    return;
  }

  const body = await readJsonBody(requestEvent.request);
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const role = typeof body.role === 'string' ? (body.role as Role) : ('' as Role);

  if (!username || !password || !VALID_ROLES.includes(role)) {
    requestEvent.json(400, { error: 'username, password and a valid role (admin/editor/viewer) are required' });
    return;
  }

  try {
    const created = createUser(username, password, role);
    requestEvent.json(201, created);
  } catch {
    requestEvent.json(400, { error: 'Username already exists' });
  }
};
