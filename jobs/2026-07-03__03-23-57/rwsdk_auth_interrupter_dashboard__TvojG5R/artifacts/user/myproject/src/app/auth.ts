import { parseCookies, verifySession } from "./session.js";

/**
 * Route interrupter to protect routes that require authentication.
 * If not authenticated, redirects to /login.
 */
export async function isAuthenticated({ request, ctx }: { request: Request; ctx: any }) {
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies["session"];
  const username = verifySession(sessionToken);

  if (!username) {
    return Response.redirect(new URL("/login", request.url).toString(), 302);
  }

  // Save the authenticated username to context for downstream handlers
  ctx.username = username;
}
