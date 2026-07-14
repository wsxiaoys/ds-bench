import { render, route } from "rwsdk/router";
import { defineApp, type RequestInfo } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

import users from "../users.json";

type StoredUser = {
  id: string;
  username: string;
  password: string;
};

type SessionData = {
  userId: string;
};

export type AppContext = {
  user: { id: string; username: string } | null;
};

const SESSION_COOKIE_NAME = "session_id";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

const getCookie = (request: Request, name: string): string | undefined => {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;
  for (const rawCookie of cookieHeader.split(";")) {
    const trimmed = rawCookie.trim();
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex);
    if (key !== name) continue;
    return trimmed.slice(separatorIndex + 1);
  }
  return undefined;
};

const buildSessionCookie = (
  sessionId: string,
  maxAgeSeconds?: number,
): string => {
  const isDev = !!import.meta.env.VITE_IS_DEV_SERVER;
  let cookie = `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax`;
  if (!isDev) cookie += "; Secure";
  if (maxAgeSeconds !== undefined) {
    cookie += `; Max-Age=${maxAgeSeconds}`;
  }
  return cookie;
};

const generateSessionId = async (): Promise<string> => {
  // 32 random bytes -> 256 bits of entropy, base64url-encoded for cookie safety
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  let binary = "";
  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const jsonResponse = (
  body: unknown,
  status: number = 200,
  extraHeaders: Record<string, string> = {},
): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
};

const unauthorized = (): Response =>
  jsonResponse({ error: "Unauthorized" }, 401);

const handleLogin = async ({
  request,
}: RequestInfo<AppContext>): Promise<Response> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as Record<string, unknown>).username !== "string" ||
    typeof (body as Record<string, unknown>).password !== "string"
  ) {
    return jsonResponse(
      { error: "Missing or invalid username or password" },
      400,
    );
  }

  const { username, password } = body as { username: string; password: string };

  const matchedUser = (users as StoredUser[]).find(
    (u) => u.username === username && u.password === password,
  );

  if (!matchedUser) {
    return jsonResponse({ error: "Invalid credentials" }, 401);
  }

  const sessionId = await generateSessionId();
  const sessionData: SessionData = { userId: matchedUser.id };

  await env.SESSIONS.put(sessionId, JSON.stringify(sessionData), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  return jsonResponse(
    { id: matchedUser.id, username: matchedUser.username },
    200,
    {
      "Set-Cookie": buildSessionCookie(sessionId, SESSION_TTL_SECONDS),
    },
  );
};

const handleLogout = async ({
  request,
}: RequestInfo<AppContext>): Promise<Response> => {
  const sessionId = getCookie(request, SESSION_COOKIE_NAME);
  if (sessionId) {
    await env.SESSIONS.delete(sessionId);
  }

  return new Response(null, {
    status: 200,
    headers: {
      "Set-Cookie": buildSessionCookie("", 0),
    },
  });
};

const requireSession = async ({
  request,
  ctx,
}: RequestInfo<AppContext>): Promise<Response | void> => {
  const sessionId = getCookie(request, SESSION_COOKIE_NAME);
  if (!sessionId) {
    return unauthorized();
  }

  const raw = await env.SESSIONS.get(sessionId);
  if (!raw) {
    return unauthorized();
  }

  let sessionData: SessionData;
  try {
    sessionData = JSON.parse(raw) as SessionData;
  } catch {
    return unauthorized();
  }

  const user = (users as StoredUser[]).find(
    (u) => u.id === sessionData.userId,
  );
  if (!user) {
    return unauthorized();
  }

  ctx.user = { id: user.id, username: user.username };
};

const handleProfile = async ({
  ctx,
}: RequestInfo<AppContext>): Promise<Response> => {
  if (!ctx.user) {
    return unauthorized();
  }
  return jsonResponse({
    id: ctx.user.id,
    username: ctx.user.username,
  });
};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    ctx.user = null;
  },
  route("/login", {
    post: handleLogin,
  }),
  route("/logout", {
    post: handleLogout,
  }),
  route("/profile", {
    get: [requireSession, handleProfile],
  }),
  render(Document, [route("/", Home)]),
]);