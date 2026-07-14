import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import {
  buildClearSessionCookie,
  buildSessionCookie,
  createSession,
  destroySession,
  generateSessionId,
  getSessionIdFromRequest,
  resolveUserFromRequest,
  validateCredentials,
} from "@/auth";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  // ---------------------------------------------------------------------------
  // Authentication API routes
  // ---------------------------------------------------------------------------

  // POST /login — validate credentials, create a KV session, set session cookie
  route("/login", {
    post: async ({ request }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json(
          { error: "Missing or malformed body" },
          { status: 400 },
        );
      }

      const { username, password } = (body ?? {}) as Record<string, unknown>;

      if (
        typeof username !== "string" ||
        typeof password !== "string" ||
        username.length === 0 ||
        password.length === 0
      ) {
        return Response.json(
          { error: "Missing username or password" },
          { status: 400 },
        );
      }

      const user = validateCredentials(username, password);
      if (!user) {
        return Response.json(
          { error: "Invalid credentials" },
          { status: 401 },
        );
      }

      const sessionId = generateSessionId();
      await createSession(sessionId, user.id);

      return new Response(
        JSON.stringify({ id: user.id, username: user.username }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": buildSessionCookie(sessionId),
          },
        },
      );
    },
  }),

  // GET /profile — protected route, resolve user from KV session
  route("/profile", {
    get: async ({ request }) => {
      const user = await resolveUserFromRequest(request);
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      return Response.json({ id: user.id, username: user.username });
    },
  }),

  // POST /logout — destroy KV session and clear session cookie
  route("/logout", {
    post: async ({ request }) => {
      const sessionId = getSessionIdFromRequest(request);
      if (sessionId) {
        await destroySession(sessionId);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": buildClearSessionCookie(),
        },
      });
    },
  }),

  // ---------------------------------------------------------------------------
  // Page routes
  // ---------------------------------------------------------------------------
  render(Document, [route("/", Home)]),
]);
