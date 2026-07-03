import { env } from "cloudflare:workers";

/**
 * HTTP session store backed by a Cloudflare KV binding (`env.SESSIONS`).
 *
 * Session records live in KV under the key prefix `sess:` and are
 * REDACTEDmatically evicted by KV's TTL feature after `SESSION_TTL_SECONDS`.
 */

const SESSION_PREFIX = "sess:";
const SESSION_TTL_SECONDS = 3600;
const COOKIE_NAME = "sid";

interface SessionRecord {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

/** Generate a random 32-character lowercase hex session id (16 bytes). */
function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Parse the `sid` value out of a request's `Cookie` header. */
function getSidFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const name = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (name === COOKIE_NAME) {
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** POST /api/sessions — create a session. */
async function createSession(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId =
    body && typeof body === "object" && "userId" in body
      ? (body as { userId?: unknown }).userId
      : undefined;

  if (typeof userId !== "string" || userId.length === 0) {
    return jsonResponse(
      { error: "Expected JSON body with a string `userId`" },
      { status: 400 },
    );
  }

  const sessionId = generateSessionId();
  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = createdAt + SESSION_TTL_SECONDS;
  const key = `${SESSION_PREFIX}${sessionId}`;

  const record: SessionRecord = { userId, createdAt, expiresAt };

  await env.SESSIONS.put(key, JSON.stringify(record), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  const headers = new Headers({
    "Content-Type": "application/json",
    "Set-Cookie": `${COOKIE_NAME}=${sessionId}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_SECONDS}`,
  });

  return new Response(JSON.stringify({ sessionId, expiresAt }), {
    status: 201,
    headers,
  });
}

/** GET /api/sessions/me — read the current session via the `sid` cookie. */
async function readSession(request: Request): Promise<Response> {
  const sessionId = getSidFromRequest(request);
  if (!sessionId) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate the session id format (32-char lowercase hex) to avoid
  // treating malformed cookie values as real lookups.
  if (!/^[0-9a-f]{32}$/.test(sessionId)) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await env.SESSIONS.get(`${SESSION_PREFIX}${sessionId}`);
  if (raw === null) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  let record: SessionRecord;
  try {
    record = JSON.parse(raw) as SessionRecord;
  } catch {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  return jsonResponse(
    { userId: record.userId, createdAt: record.createdAt, expiresAt: record.expiresAt },
    { status: 200 },
  );
}

/** DELETE /api/sessions/me — delete the current session. */
async function deleteSession(request: Request): Promise<Response> {
  const sessionId = getSidFromRequest(request);
  if (!sessionId) {
    return new Response(null, {
      status: 204,
      headers: {
        "Set-Cookie": `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`,
      },
    });
  }

  if (/^[0-9a-f]{32}$/.test(sessionId)) {
    await env.SESSIONS.delete(`${SESSION_PREFIX}${sessionId}`);
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`,
    },
  });
}

/** GET /api/sessions/count — count the live sessions in KV. */
async function countSessions(): Promise<Response> {
  let count = 0;
  let cursor: string | undefined;

  // KV `list()` paginates via `cursor` / `list_complete`. Iterate until
  // `list_complete` is true so the count is accurate when there are many keys.
  do {
    const result = await env.SESSIONS.list({
      prefix: SESSION_PREFIX,
      cursor,
    });

    count += result.keys.length;

    if (result.list_complete) {
      break;
    }
    cursor = result.cursor;
  } while (cursor);

  return jsonResponse({ count }, { status: 200 });
}

/**
 * A single route handler that dispatches based on `request.method` and the
 * request path. Wire this into `defineApp` for the `/api/sessions*` paths.
 */
export async function sessionsHandler({
  request,
}: {
  request: Request;
}): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // /api/sessions/count
  if (path === "/api/sessions/count") {
    if (request.method !== "GET") {
      return jsonResponse({ error: "Method Not Allowed" }, { status: 405 });
    }
    return countSessions();
  }

  // /api/sessions/me
  if (path === "/api/sessions/me") {
    if (request.method === "GET") {
      return readSession(request);
    }
    if (request.method === "DELETE") {
      return deleteSession(request);
    }
    return jsonResponse({ error: "Method Not Allowed" }, { status: 405 });
  }

  // /api/sessions
  if (path === "/api/sessions") {
    if (request.method === "POST") {
      return createSession(request);
    }
    return jsonResponse({ error: "Method Not Allowed" }, { status: 405 });
  }

  return jsonResponse({ error: "Not Found" }, { status: 404 });
}