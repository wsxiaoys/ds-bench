import { getSessionUsername } from "./session";

/**
 * Interrupter that checks if the user is authenticated.
 * If authenticated, sets ctx.username and continues to the next handler.
 * If not authenticated, redirects to /login with a 302 status.
 *
 * This interrupter uses rwsdk's interrupter pattern:
 * it is passed as an element in the route definition array
 * before the final handler, e.g. route("/dashboard", [isAuthenticated, handler])
 */
export async function isAuthenticated({
  request,
  ctx,
}: {
  request: Request;
  ctx: { username?: string };
}): Promise<Response | void> {
  const username = await getSessionUsername(request);

  if (!username) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/login" },
    });
  }

  ctx.username = username;
}