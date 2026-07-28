import type { RequestHandler } from '@builder.io/qwik-city';
import { deleteSession } from '~/lib/auth';

export const onPost: RequestHandler = async (requestEvent) => {
  const token = requestEvent.cookie.get('session')?.value;
  deleteSession(token);
  requestEvent.cookie.delete('session', { path: '/' });
  requestEvent.json(200, { success: true });
};
