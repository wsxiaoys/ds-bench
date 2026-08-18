import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import users from "../users.json";

export type AppContext = {};

const getSessionId = (request: Request): string | null => {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "session_id") {
      return value || null;
    }
  }
  return null;
};

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
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (
        !body ||
        typeof body !== "object" ||
        typeof body.username !== "string" ||
        typeof body.password !== "string"
      ) {
        return new Response(
          JSON.stringify({ error: "Missing or malformed username or password" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const user = users.find(
        (u) => u.username === body.username && u.password === body.password
      );

      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const sessionId = crypto.randomUUID();
      await env.SESSIONS.put(
        sessionId,
        JSON.stringify({ id: user.id, username: user.username })
      );

      return new Response(
        JSON.stringify({ id: user.id, username: user.username }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": `session_id=${sessionId}; Path=/; HttpOnly`,
          },
        }
      );
    },
  }),
  route("/profile", {
    get: async ({ request }) => {
      const sessionId = getSessionId(request);
      if (!sessionId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const sessionDataStr = await env.SESSIONS.get(sessionId);
      if (!sessionDataStr) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      let sessionData: any;
      try {
        sessionData = JSON.parse(sessionDataStr);
      } catch (e) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const user = users.find((u) => u.id === sessionData.id);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
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
      const sessionId = getSessionId(request);
      if (sessionId) {
        await env.SESSIONS.delete(sessionId);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie":
            "session_id=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0",
        },
      });
    },
  }),
  render(Document, [route("/", Home)]),
]);
