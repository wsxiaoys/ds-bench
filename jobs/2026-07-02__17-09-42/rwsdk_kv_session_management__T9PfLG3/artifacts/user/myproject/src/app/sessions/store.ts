import { env } from "cloudflare:workers";

/**
 * HTTP session store backed by a Cloudflare KV namespace (`SESSIONS`).
 *
 * Session records are stored under `sess:<sessionId>` keys. Each value is a
 * JSON document of the shape `{ userId, createdAt, expiresAt }`. Expired
 * records are evicted REDACTEDmatically by KV via the `expirationTtl` we set on
 * write.
 */

export const SESSION_KEY_PREFIX = "sess:";
export const SESSION_COOKIE_NAME = "sid";
/** Session lifetime in seconds — also used as the KV `expirationTtl`. */
export const SESSION_TTL_SECONDS = 3600;

export interface SessionRecord {
  userId: string;
  /** Unix timestamp in seconds when the session was created. */
  createdAt: number;
  /** Unix timestamp in seconds when the session expires. */
  expiresAt: number;
}

const SESSION_ID_BYTES = 16;

/**
 * Generate a fresh 32-character lowercase hex session id (16 random bytes,
 * hex-encoded). Uses the Web Crypto API which is available in the
 * Cloudflare Workers / workerd runtime.
 */
export const generateSessionId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(SESSION_ID_BYTES));
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
};

/**
 * Resolve the `SESSIONS` KV namespace binding. Throws if the binding is
 * missing so misconfiguration is caught early rather than at request time.
 */
const getSessionsBinding = (): KVNamespace => {
  const binding = (env as unknown as { SESSIONS?: KVNamespace }).SESSIONS;
  if (!binding) {
    throw new Error(
      "SESSIONS KV namespace binding is not configured. " +
        "Add a `kv_namespaces` entry with `binding: \"SESSIONS\"` to wrangler.jsonc.",
    );
  }
  return binding;
};

const sessionKey = (sessionId: string): string => SESSION_KEY_PREFIX + sessionId;

export const createSession = async (
  userId: string,
): Promise<{ sessionId: string; record: SessionRecord }> => {
  const sessionId = generateSessionId();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const record: SessionRecord = {
    userId,
    createdAt: nowSeconds,
    expiresAt: nowSeconds + SESSION_TTL_SECONDS,
  };
  await getSessionsBinding().put(sessionKey(sessionId), JSON.stringify(record), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return { sessionId, record };
};

export const getSession = async (
  sessionId: string,
): Promise<SessionRecord | null> => {
  const raw = await getSessionsBinding().get(sessionKey(sessionId));
  if (raw === null) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SessionRecord>;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.createdAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  await getSessionsBinding().delete(sessionKey(sessionId));
};

/**
 * Count the number of sessions currently stored in KV. Iterates over all
 * pages returned by `list()` until `list_complete` is true so the count is
 * accurate even when there are more than 1000 sessions.
 */
export const countSessions = async (): Promise<number> => {
  const binding = getSessionsBinding();
  let total = 0;
  let cursor: string | undefined;
  while (true) {
    const result = await binding.list({
      prefix: SESSION_KEY_PREFIX,
      ...(cursor ? { cursor } : {}),
    });
    total += result.keys.length;
    if (result.list_complete) {
      break;
    }
    cursor = result.cursor;
  }
  return total;
};

/**
 * Parse the `sid` cookie value out of a `Cookie` request header. Returns
 * `undefined` when the cookie is missing or malformed.
 */
export const parseSessionCookie = (
  cookieHeader: string | null | undefined,
): string | undefined => {
  if (!cookieHeader) {
    return undefined;
  }
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const name = trimmed.slice(0, eq);
    if (name !== SESSION_COOKIE_NAME) {
      continue;
    }
    const value = trimmed.slice(eq + 1).trim();
    if (!value) {
      return undefined;
    }
    return value;
  }
  return undefined;
};