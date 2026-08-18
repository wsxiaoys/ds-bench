import { type RequestHandler } from '@builder.io/qwik-city';
import { deleteSession } from '../../../auth';

export const onPost: RequestHandler = async (event) => {
  const sessionId = event.cookie.get('session')?.value;
  if (sessionId) {
    deleteSession(sessionId);
  }
  event.cookie.delete('session', { path: '/' });
  event.status(200);
  return event.json(200, { success: true });
};
