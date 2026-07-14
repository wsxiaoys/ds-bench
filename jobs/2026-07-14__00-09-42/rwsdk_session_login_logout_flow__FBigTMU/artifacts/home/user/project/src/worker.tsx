import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import {
  buildSessionCookie,
  clearSessionCookie,
  createSession,
  destroySession,
  getSession,
  parseSessionCookie,
} from "@/lib/session";

// Load users from the seed file at module initialisation time.
// Vite / workerd can inline JSON imports via the bundler.
import users from "../users.json";

export type AppContext = {};

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------
async function handleLogin(request: Request): Promise<Response> {
  // Validate Content-Type / body
  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { username, password } = body;

  if (
    typeof username !== "string" ||
    !username ||
    typeof password !== "string" ||
    !password
  ) {
    return new Response(
      JSON.stringify({ error: "Missing username or password" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Validate credentials against users.json
  const user = (users as Array<{ id: string; username: string; password: string }>).find(
    (u) => u.username === username && u.password === password,
  );

  if (!user) {
    return new Response(JSON.stringify({ error: "Invalid credentials" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create a server-side session in KV
  const sessionId = await createSession(env.SESSIONS, {
    userId: user.id,
    username: user.username,
  });

  return new Response(JSON.stringify({ id: user.id, username: user.username }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": buildSessionCookie(sessionId),
    },
  });
}

// ---------------------------------------------------------------------------
// GET /profile
// ---------------------------------------------------------------------------
async function handleProfile(request: Request): Promise<Response> {
  const cookieHeader = request.headers.get("cookie");
  const sessionId = parseSessionCookie(cookieHeader);
  const session = await getSession(env.SESSIONS, sessionId);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ id: session.userId, username: session.username }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------
async function handleLogout(request: Request): Promise<Response> {
  const cookieHeader = request.headers.get("cookie");
  const sessionId = parseSessionCookie(cookieHeader);
  await destroySession(env.SESSIONS, sessionId);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearSessionCookie(),
    },
  });
}

// ---------------------------------------------------------------------------
// App definition
// ---------------------------------------------------------------------------
export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/login", {
    post: ({ request }) => handleLogin(request),
  }),
  route("/profile", {
    get: ({ request }) => handleProfile(request),
  }),
  route("/logout", {
    post: ({ request }) => handleLogout(request),
  }),
  render(Document, [route("/", Home)]),
]);
