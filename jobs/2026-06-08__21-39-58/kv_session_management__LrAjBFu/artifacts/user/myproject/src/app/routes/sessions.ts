import { route } from "rwsdk/router";
import { env } from "cloudflare:workers";

const SESSION_PREFIX = "sess:";
const SESSION_TTL = 3600;

function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseSidCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]*)/);
  return match ? match[1] : null;
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const sessionsRoutes = [
  route("/api/sessions", {
    post: async ({ request }) => {
      let body: { userId: string };
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      if (!body.userId || typeof body.userId !== "string") {
        return jsonResponse({ error: "userId is required" }, 400);
      }

      const sessionId = generateSessionId();
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + SESSION_TTL;

      const sessionData = {
        userId: body.userId,
        createdAt: now,
        expiresAt,
      };

      await env.SESSIONS.put(
        `${SESSION_PREFIX}${sessionId}`,
        JSON.stringify(sessionData),
        { expirationTtl: SESSION_TTL }
      );

      const response = jsonResponse({ sessionId, expiresAt }, 201);
      response.headers.set(
        "Set-Cookie",
        `sid=${sessionId}; HttpOnly; Path=/; Max-Age=${SESSION_TTL}`
      );
      return response;
    },
  }),

  route("/api/sessions/me", {
    get: async ({ request }) => {
      const sid = parseSidCookie(request);
      if (!sid || !/^[0-9a-f]{32}$/.test(sid)) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const raw = await env.SESSIONS.get(`${SESSION_PREFIX}${sid}`);
      if (!raw) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const session = JSON.parse(raw) as {
        userId: string;
        createdAt: number;
        expiresAt: number;
      };

      return jsonResponse(
        {
          userId: session.userId,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        },
        200
      );
    },

    delete: async ({ request }) => {
      const sid = parseSidCookie(request);
      if (!sid || !/^[0-9a-f]{32}$/.test(sid)) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      await env.SESSIONS.delete(`${SESSION_PREFIX}${sid}`);

      const response = new Response(null, { status: 204 });
      response.headers.set(
        "Set-Cookie",
        "sid=; HttpOnly; Path=/; Max-Age=0"
      );
      return response;
    },
  }),

  route("/api/sessions/count", {
    get: async () => {
      let count = 0;
      let cursor: string | undefined;

      do {
        const result = await env.SESSIONS.list({
          prefix: SESSION_PREFIX,
          cursor,
        });
        count += result.keys.length;
        cursor = result.list_complete ? undefined : result.cursor;
      } while (cursor);

      return jsonResponse({ count }, 200);
    },
  }),
];
