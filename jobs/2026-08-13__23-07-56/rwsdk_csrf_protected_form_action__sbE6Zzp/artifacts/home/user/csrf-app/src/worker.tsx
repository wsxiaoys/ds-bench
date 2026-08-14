import { render, route, RouteMiddleware } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

const parseCookie = (cookieHeader: string, name: string): string | undefined => {
  if (!cookieHeader) return undefined;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const [k, v] = pair.trim().split("=");
    if (k === name) return v;
  }
  return undefined;
};

export const validateCsrf = (): RouteMiddleware => async ({ request }) => {
  try {
    const clonedRequest = request.clone();
    const formData = await clonedRequest.formData();
    const csrfToken = formData.get("csrf_token");

    const cookieHeader = request.headers.get("cookie") || "";
    const cookieToken = parseCookie(cookieHeader, "csrf_token");

    if (!csrfToken || !cookieToken || csrfToken !== cookieToken) {
      return new Response("Forbidden", { status: 403 });
    }
  } catch (err) {
    return new Response("Forbidden", { status: 403 });
  }
};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", {
      get: async (requestInfo) => {
        const token = crypto.randomUUID();
        requestInfo.response.headers.set("Set-Cookie", `csrf_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
        return <Home csrfToken={token} />;
      }
    }),
  ]),
  route("/submit", {
    post: [
      validateCsrf(),
      async ({ request }) => {
        try {
          const formData = await request.formData();
          const message = formData.get("message");
          if (typeof message !== "string") {
            return new Response("Bad Request", { status: 400 });
          }

          const typedEnv = env as unknown as Env;
          const messagesStr = await typedEnv.MESSAGES_KV.get("messages");
          const messages = messagesStr ? JSON.parse(messagesStr) : [];
          messages.push(message);
          await typedEnv.MESSAGES_KV.put("messages", JSON.stringify(messages));

          return new Response("Success", { status: 200 });
        } catch (e) {
          return new Response("Internal Server Error", { status: 500 });
        }
      }
    ]
  }),
  route("/messages", {
    get: async () => {
      try {
        const typedEnv = env as unknown as Env;
        const messagesStr = await typedEnv.MESSAGES_KV.get("messages");
        const messages = messagesStr ? JSON.parse(messagesStr) : [];
        return Response.json(messages);
      } catch (e) {
        return Response.json([]);
      }
    }
  })
]);
