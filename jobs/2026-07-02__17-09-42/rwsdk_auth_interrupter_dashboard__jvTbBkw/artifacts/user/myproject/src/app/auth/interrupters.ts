import type { AppContext } from "@/worker";
import { verifySessionCookie } from "@/app/auth/session";

import type { RequestInfo } from "rwsdk/worker";

/**
 * Per-route interrupter that gates `/dashboard` behind a valid signed
 * session cookie.
 *
 * - On success, populates `ctx.user` so downstream handlers can render the
 *   signed-in state and falls through to the next route handler.
 * - On failure (missing cookie, tampered signature, unknown user), short
 *   circuits the request with a `302` redirect to `/login`.
 */
export async function isAuthenticated(
  { request, ctx }: RequestInfo<any, AppContext>,
): Promise<Response | void> {
  const username = await verifySessionCookie(request);
  if (username) {
    ctx.user = { username };
    return;
  }

  return new Response(null, {
    status: 302,
    headers: { Location: "/login" },
  });
}