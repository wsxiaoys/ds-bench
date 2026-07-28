import type { RequestHandler } from '@builder.io/qwik-city';
import { getSessionUser } from '~/lib/auth';

/**
 * Global request middleware. Runs for every request before any route
 * loader/action/endpoint handler.
 *
 * It resolves the current user (if any) from the `session` cookie by
 * looking the token up in the SQLite-backed sessions table, and stores the
 * result on `sharedMap` under the `user` key so downstream loaders and
 * endpoints can make authorization decisions without ever trusting
 * client-supplied data.
 */
export const onRequest: RequestHandler = async ({ cookie, sharedMap }) => {
  const token = cookie.get('session')?.value;
  const user = getSessionUser(token);
  sharedMap.set('user', user);
};
