const SESSION_COOKIE_NAME = "session_id";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** Generate a cryptographically random session ID */
export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Parse the session_id value out of a Cookie header string */
export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name.trim() === SESSION_COOKIE_NAME) {
      return rest.join("=").trim() || null;
    }
  }
  return null;
}

/** Build a Set-Cookie header value that creates the session cookie */
export function buildSessionCookie(sessionId: string): string {
  return `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; Path=/; SameSite=Lax`;
}

/** Build a Set-Cookie header value that clears the session cookie */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export interface SessionData {
  userId: string;
  username: string;
}

/** Persist a new session in KV and return the generated session ID */
export async function createSession(
  kv: KVNamespace,
  data: SessionData,
): Promise<string> {
  const sessionId = generateSessionId();
  await kv.put(sessionId, JSON.stringify(data), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return sessionId;
}

/** Retrieve session data from KV, or null if not found / expired */
export async function getSession(
  kv: KVNamespace,
  sessionId: string | null,
): Promise<SessionData | null> {
  if (!sessionId) return null;
  const raw = await kv.get(sessionId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

/** Delete a session from KV */
export async function destroySession(
  kv: KVNamespace,
  sessionId: string | null,
): Promise<void> {
  if (!sessionId) return;
  await kv.delete(sessionId);
}
