import { env } from "cloudflare:workers";
import usersData from "../users.json";

export type User = {
  id: string;
  username: string;
};

type StoredUser = {
  id: string;
  username: string;
  password: string;
};

const users: StoredUser[] = usersData as StoredUser[];

const SESSION_COOKIE_NAME = "session_id";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Parse the Cookie header of a Request into a simple key/value map.
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();

    if (key) {
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
    }
  }

  return cookies;
}

/**
 * Extract the session id from the incoming request's Cookie header.
 */
export function getSessionIdFromRequest(request: Request): string | null {
  const cookies = parseCookies(request.headers.get("cookie"));
  const sessionId = cookies[SESSION_COOKIE_NAME];
  return sessionId || null;
}

/**
 * Build the Set-Cookie header value for setting a session cookie.
 */
export function buildSessionCookie(sessionId: string): string {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_SECONDS}; SameSite=Lax`;
}

/**
 * Build the Set-Cookie header value that clears (expires) the session cookie.
 */
export function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Validate credentials against the seed users.json file.
 * Returns the matched user (without password) or null.
 */
export function validateCredentials(
  username: string,
  password: string,
): User | null {
  const user = users.find(
    (u) => u.username === username && u.password === password,
  );

  if (!user) return null;

  return { id: user.id, username: user.username };
}

/**
 * Look up a user by id from the seed users.json file.
 * Returns the user (without password) or null.
 */
export function getUserById(userId: string): User | null {
  const user = users.find((u) => u.id === userId);
  if (!user) return null;
  return { id: user.id, username: user.username };
}

/**
 * Generate an unguessable session id using the Web Crypto API.
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Create a server-side session in KV, keyed by the session id.
 * The session value stores the user id.
 */
export async function createSession(sessionId: string, userId: string): Promise<void> {
  await env.SESSIONS.put(sessionId, JSON.stringify({ userId }));
}

/**
 * Look up a session in KV by session id.
 * Returns the stored session value (containing userId) or null
 * if the session does not exist (unknown/forged/logged-out).
 */
export async function getSession(sessionId: string): Promise<{ userId: string } | null> {
  const raw = await env.SESSIONS.get(sessionId);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { userId: string };
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Destroy a server-side session in KV.
 */
export async function destroySession(sessionId: string): Promise<void> {
  await env.SESSIONS.delete(sessionId);
}

/**
 * Resolve the authenticated user from the incoming request by looking
 * up the session cookie in KV. Returns the user (without password) or null.
 */
export async function resolveUserFromRequest(request: Request): Promise<User | null> {
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  const user = getUserById(session.userId);
  if (!user) return null;

  return user;
}

export { SESSION_COOKIE_NAME };