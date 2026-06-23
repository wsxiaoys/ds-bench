/**
 * Authentication interrupter for protecting routes.
 *
 * Uses rwsdk's interrupter pattern: a function that inspects request/ctx
 * and returns/throws a Response when not authenticated.
 */
import type { RouteMiddleware } from "rwsdk/router";
import { verifySessionCookie } from "../session";

export function isAuthenticated(): RouteMiddleware {
  return async ({ request, ctx }) => {
    const secret = (ctx as any).sessionSecret as string;
    if (!secret) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/login" },
      });
    }

    const username = await verifySessionCookie(request, secret);
    if (!username) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/login" },
      });
    }

    (ctx as any).username = username;
  };
}
