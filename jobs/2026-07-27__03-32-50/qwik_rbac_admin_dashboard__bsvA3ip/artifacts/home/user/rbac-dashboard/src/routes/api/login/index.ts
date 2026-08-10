import type { RequestHandler } from '@builder.io/qwik-city';
import { createSession, login } from '~/lib/auth';

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const onPost: RequestHandler = async (requestEvent) => {
  const body = await readJsonBody(requestEvent.request);
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const user = username && password ? login(username, password) : null;

  if (!user) {
    requestEvent.json(401, { error: 'Invalid username or password' });
    return;
  }

  const token = createSession(user.id);

  requestEvent.cookie.set('session', token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  requestEvent.json(200, { username: user.username, role: user.role });
};
