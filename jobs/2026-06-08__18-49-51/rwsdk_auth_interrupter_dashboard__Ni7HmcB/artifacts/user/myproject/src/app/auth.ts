import { getSessionUsername } from "./session.js";

// In-memory user store — demo credentials
const USERS: Record<string, string> = {
  demo: "pass",
};

/** Validates credentials. Returns the username on success, null on failure. */
export function validateCredentials(username: string, password: string): string | null {
  const stored = USERS[username];
  if (stored && stored === password) {
    return username;
  }
  return null;
}

/**
 * Interrupter (route-scoped middleware) that protects a route.
 * If the request has no valid session cookie, it redirects to /login.
 * Otherwise, it attaches `ctx.username` for downstream handlers.
 */
export async function isAuthenticated({
  request,
  ctx,
}: {
  request: Request;
  ctx: Record<string, unknown>;
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
