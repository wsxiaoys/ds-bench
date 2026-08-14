import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import users from "../users.json";

export type AppContext = {};

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const parts = pair.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join("=").trim();
      cookies[key] = value;
    }
  }
  return cookies;
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/login", {
    post: async ({ request }) => {
      let body: any;
      try {
        body = await request.json();
      } catch (e) {
        return new Response("Malformed body", { status: 400 });
      }

      if (
        !body ||
        typeof body !== "object" ||
        typeof body.username !== "string" ||
        typeof body.password !== "string"
      ) {
        return new Response("Missing or malformed username or password", { status: 400 });
      }

      const user = users.find(
        (u) => u.username === body.username && u.password === body.password
      );

      if (!user) {
        return new Response("Unauthorized", { status: 401 });
      }

      const sessionId = crypto.randomUUID();
      await env.SESSIONS.put(
        sessionId,
        JSON.stringify({ id: user.id, username: user.username })
      );

      const headers = new Headers({
        "Content-Type": "application/json",
        "Set-Cookie": `session_id=${sessionId}; Path=/; HttpOnly`,
      });

      return new Response(
        JSON.stringify({ id: user.id, username: user.username }),
        { status: 200, headers }
      );
    },
  }),
  route("/profile", {
    get: async ({ request }) => {
      const cookieHeader = request.headers.get("cookie");
      const cookies = parseCookies(cookieHeader);
      const sessionId = cookies["session_id"];

      if (!sessionId) {
        return new Response("Unauthorized", { status: 401 });
      }

      const sessionData = await env.SESSIONS.get(sessionId);
      if (!sessionData) {
        return new Response("Unauthorized", { status: 401 });
      }

      let sessionUser: any;
      try {
        sessionUser = JSON.parse(sessionData);
      } catch (e) {
        return new Response("Unauthorized", { status: 401 });
      }

      if (!sessionUser || typeof sessionUser.id !== "string" || typeof sessionUser.username !== "string") {
        return new Response("Unauthorized", { status: 401 });
      }

      return new Response(
        JSON.stringify({ id: sessionUser.id, username: sessionUser.username }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    },
  }),
  route("/logout", {
    post: async ({ request }) => {
      const cookieHeader = request.headers.get("cookie");
      const cookies = parseCookies(cookieHeader);
      const sessionId = cookies["session_id"];

      if (sessionId) {
        await env.SESSIONS.delete(sessionId);
      }

      const headers = new Headers({
        "Set-Cookie": "session_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly",
      });

      return new Response("Logged out", { status: 200, headers });
    },
  }),
  render(Document, [route("/", Home)]),
]);
