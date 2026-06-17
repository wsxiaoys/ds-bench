import { env } from "cloudflare:workers";

// Generate a random 32-character lowercase hex session ID (16 bytes)
function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Parse the "sid" value from the Cookie header
function parseSidCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name.trim() === "sid") {
      return rest.join("=").trim() || null;
    }
  }
  return null;
}

const SESSION_TTL = 3600; // seconds

interface SessionData {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

// POST /api/sessions — create a new session
async function createSession(request: Request): Promise<Response> {
  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = body?.userId;
  if (!userId || typeof userId !== "string") {
    return new Response(JSON.stringify({ error: "userId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessionId = generateSessionId();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL;

  const sessionData: SessionData = { userId, createdAt: now, expiresAt };

  await (env.SESSIONS as KVNamespace).put(
    `sess:${sessionId}`,
    JSON.stringify(sessionData),
    { expirationTtl: SESSION_TTL },
  );

  return new Response(JSON.stringify({ sessionId, expiresAt }), {
    status: 201,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `sid=${sessionId}; HttpOnly; Path=/; Max-Age=${SESSION_TTL}`,
    },
  });
}

// GET /api/sessions/me — read the current session
async function getSession(request: Request): Promise<Response> {
  const sid = parseSidCookie(request);
  if (!sid) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const raw = await (env.SESSIONS as KVNamespace).get(`sess:${sid}`);
  if (!raw) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let sessionData: SessionData;
  try {
    sessionData = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      userId: sessionData.userId,
      createdAt: sessionData.createdAt,
      expiresAt: sessionData.expiresAt,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

// DELETE /api/sessions/me — delete the current session
async function deleteSession(request: Request): Promise<Response> {
  const sid = parseSidCookie(request);
  if (!sid) {
    return new Response(null, { status: 204 });
  }

  await (env.SESSIONS as KVNamespace).delete(`sess:${sid}`);

  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": `sid=; HttpOnly; Path=/; Max-Age=0`,
    },
  });
}

// GET /api/sessions/count — count all live sessions
async function countSessions(): Promise<Response> {
  let count = 0;
  let cursor: string | undefined = undefined;
  let listComplete = false;

  while (!listComplete) {
    const result: KVNamespaceListResult<unknown, string> = await (
      env.SESSIONS as KVNamespace
    ).list({ prefix: "sess:", cursor });
    count += result.keys.length;
    listComplete = result.list_complete;
    if (!listComplete && result.cursor) {
      cursor = result.cursor;
    }
  }

  return new Response(JSON.stringify({ count }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Main handler that dispatches to sub-handlers based on URL path and method
export async function sessionsHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  if (pathname === "/api/sessions" || pathname === "/api/sessions/") {
    if (method === "POST") {
      return createSession(request);
    }
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (pathname === "/api/sessions/me") {
    if (method === "GET") {
      return getSession(request);
    }
    if (method === "DELETE") {
      return deleteSession(request);
    }
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (pathname === "/api/sessions/count") {
    if (method === "GET") {
      return countSessions();
    }
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
