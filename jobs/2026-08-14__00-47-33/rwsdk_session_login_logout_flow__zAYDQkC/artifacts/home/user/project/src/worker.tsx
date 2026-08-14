import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import users from "../users.json";

export type AppContext = {};

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";");
  for (let cookie of cookies) {
    const parts = cookie.trim().split("=");
    const key = parts[0];
    const value = parts.slice(1).join("=");
    if (key === name) {
      return value;
    }
  }
  return null;
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
        return new Response("Bad Request: Malformed JSON", { status: 400 });
      }

      if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
        return new Response("Bad Request: Missing username or password", { status: 400 });
      }

      const user = users.find(
        (u) => u.username === body.username && u.password === body.password
      );

      if (!user) {
        return new Response("Unauthorized", { status: 401 });
      }

      const sessionId = crypto.randomUUID();
      await env.SESSIONS.put(sessionId, user.id);

      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      headers.set("Set-Cookie", `session_id=${sessionId}; HttpOnly; Path=/`);

      return new Response(
        JSON.stringify({ id: user.id, username: user.username }),
        {
          status: 200,
          headers,
        }
      );
    },
  }),
  route("/profile", {
    get: async ({ request }) => {
      const sessionId = getCookie(request, "session_id");
      if (!sessionId) {
        return new Response("Unauthorized", { status: 401 });
      }

      const userId = await env.SESSIONS.get(sessionId);
      if (!userId) {
        return new Response("Unauthorized", { status: 401 });
      }

      const user = users.find((u) => u.id === userId);
      if (!user) {
        return new Response("Unauthorized", { status: 401 });
      }

      return new Response(
        JSON.stringify({ id: user.id, username: user.username }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    },
  }),
  route("/logout", {
    post: async ({ request }) => {
      const sessionId = getCookie(request, "session_id");
      if (sessionId) {
        await env.SESSIONS.delete(sessionId);
      }

      const headers = new Headers();
      headers.set(
        "Set-Cookie",
        "session_id=; HttpOnly; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
      );

      return new Response("Logged out", {
        status: 200,
        headers,
      });
    },
  }),
  render(Document, [route("/", Home)]),
]);
