import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

// --- Session helpers ---

function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseSidCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith("sid=")) {
      const value = trimmed.slice(4);
      if (/^[0-9a-f]{32}$/.test(value)) {
        return value;
      }
    }
  }
  return null;
}

// --- Session API route handlers ---

async function createSession(request: Request): Promise<Response> {
  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.userId || typeof body.userId !== "string") {
    return new Response(JSON.stringify({ error: "userId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessionId = generateSessionId();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 3600;

  const sessionData = {
    userId: body.userId,
    createdAt: now,
    expiresAt,
  };

  await env.SESSIONS.put(`sess:${sessionId}`, JSON.stringify(sessionData), {
    expirationTtl: 3600,
  });

  return new Response(
    JSON.stringify({ sessionId, expiresAt }),
    {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `sid=${sessionId}; HttpOnly; Path=/; Max-Age=3600`,
      },
    },
  );
}

async function getSession(request: Request): Promise<Response> {
  const sid = parseSidCookie(request.headers.get("Cookie"));

  if (!sid) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const raw = await env.SESSIONS.get(`sess:${sid}`);
  if (!raw) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = JSON.parse(raw);
  return new Response(
    JSON.stringify({
      userId: session.userId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function deleteSession(request: Request): Promise<Response> {
  const sid = parseSidCookie(request.headers.get("Cookie"));

  if (!sid) {
    return new Response(null, {
      status: 204,
      headers: {
        "Set-Cookie": "sid=; HttpOnly; Path=/; Max-Age=0",
      },
    });
  }

  await env.SESSIONS.delete(`sess:${sid}`);

  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": "sid=; HttpOnly; Path=/; Max-Age=0",
    },
  });
}

async function countSessions(): Promise<Response> {
  let count = 0;
  let cursor: string | undefined;

  do {
    const list = await env.SESSIONS.list({ prefix: "sess:", cursor });
    count += list.keys.length;
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return new Response(JSON.stringify({ count }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// --- App definition ---

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  // Session API endpoints
  route("/api/sessions", {
    post: ({ request }) => createSession(request),
  }),
  route("/api/sessions/me", {
    get: ({ request }) => getSession(request),
    delete: ({ request }) => deleteSession(request),
  }),
  route("/api/sessions/count", {
    get: () => countSessions(),
  }),
  render(Document, [route("/", Home)]),
]);