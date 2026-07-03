import { route } from "rwsdk/router";

import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  countSessions,
  createSession,
  deleteSession,
  getSession,
  parseSessionCookie,
} from "./store";

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
};

/**
 * Build a `Set-Cookie` header value for the session cookie. When
 * `clear` is true, the cookie is expired via `Max-Age=0` instead of being
 * issued with the provided session id.
 */
const buildSessionCookie = (sessionId: string, clear: boolean): string => {
  const segments = [
    `${SESSION_COOKIE_NAME}=${clear ? "" : sessionId}`,
    "Path=/",
    "HttpOnly",
  ];
  segments.push(`Max-Age=${clear ? 0 : SESSION_TTL_SECONDS}`);
  return segments.join("; ");
};

const readUserId = async (request: Request): Promise<string | null> => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const userId = (payload as { userId?: unknown }).userId;
  if (typeof userId !== "string" || userId.length === 0) {
    return null;
  }
  return userId;
};

export const createSessionRoute = route("/api/sessions", {
  post: async ({ request }) => {
    const userId = await readUserId(request);
    if (userId === null) {
      return jsonResponse(
        { error: "Missing or invalid userId" },
        { status: 400 },
      );
    }

    const { sessionId, record } = await createSession(userId);

    return jsonResponse(
      { sessionId, expiresAt: record.expiresAt },
      {
        status: 201,
        headers: {
          "Set-Cookie": buildSessionCookie(sessionId, false),
        },
      },
    );
  },
});

export const meSessionRoute = route("/api/sessions/me", {
  get: async ({ request }) => {
    const sessionId = parseSessionCookie(request.headers.get("Cookie"));
    if (!sessionId) {
      return jsonResponse({ error: "Unauthorized" }, { status: 401 });
    }

    const record = await getSession(sessionId);
    if (!record) {
      return jsonResponse({ error: "Unauthorized" }, { status: 401 });
    }

    return jsonResponse({
      userId: record.userId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
    });
  },
  delete: async ({ request }) => {
    const sessionId = parseSessionCookie(request.headers.get("Cookie"));
    if (sessionId) {
      await deleteSession(sessionId);
    }

    return new Response(null, {
      status: 204,
      headers: {
        "Set-Cookie": buildSessionCookie(sessionId ?? "", true),
      },
    });
  },
});

export const countSessionsRoute = route("/api/sessions/count", {
  get: async () => {
    const count = await countSessions();
    return jsonResponse({ count });
  },
});

export const sessionRoutes = [
  createSessionRoute,
  meSessionRoute,
  countSessionsRoute,
];