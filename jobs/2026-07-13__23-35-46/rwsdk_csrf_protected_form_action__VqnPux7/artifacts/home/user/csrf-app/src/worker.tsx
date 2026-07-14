import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", async ({ response }) => {
      const token = crypto.randomUUID();
      response.headers.set("Set-Cookie", `csrf_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
      
      let messages: string[] = [];
      try {
        const messagesJson = await env.MESSAGES_KV.get("messages");
        if (messagesJson) {
          messages = JSON.parse(messagesJson);
        }
      } catch (err) {
        console.error("Error reading messages from KV:", err);
      }
      
      return <Home csrfToken={token} messages={messages} />;
    }),
    
    route("/submit", {
      post: async ({ request }) => {
        // Parse cookies
        const cookies: Record<string, string> = {};
        const cookieHeader = request.headers.get("cookie");
        if (cookieHeader) {
          for (const cookie of cookieHeader.split(";")) {
            const trimmed = cookie.trim();
            const separatorIndex = trimmed.indexOf("=");
            if (separatorIndex !== -1) {
              const key = trimmed.slice(0, separatorIndex);
              const value = trimmed.slice(separatorIndex + 1);
              cookies[key] = value;
            }
          }
        }
        
        const cookieCsrfToken = cookies["csrf_token"];
        
        let formCsrfToken: string | null = null;
        let message: string | null = null;
        try {
          const formData = await request.formData();
          formCsrfToken = formData.get("csrf_token") as string | null;
          message = formData.get("message") as string | null;
        } catch (e) {
          return new Response("Forbidden: Invalid form data", { status: 403 });
        }
        
        // Double-submit-cookie validation rule:
        // - the csrf_token form field is present, AND
        // - the csrf_token cookie is present, AND
        // - the two values are equal.
        if (!formCsrfToken || !cookieCsrfToken || formCsrfToken !== cookieCsrfToken) {
          return new Response("Forbidden: CSRF validation failed", { status: 403 });
        }
        
        // Persist message
        let messages: string[] = [];
        try {
          const messagesJson = await env.MESSAGES_KV.get("messages");
          if (messagesJson) {
            messages = JSON.parse(messagesJson);
          }
        } catch (e) {
          console.error("Error reading messages during submit:", e);
        }
        
        if (message !== null) {
          messages.push(message);
        }
        
        try {
          await env.MESSAGES_KV.put("messages", JSON.stringify(messages));
        } catch (e) {
          console.error("Error persisting message:", e);
          return new Response("Internal Server Error", { status: 500 });
        }
        
        return new Response("Success", { status: 200 });
      }
    }),
    
    route("/messages", {
      get: async () => {
        let messages: string[] = [];
        try {
          const messagesJson = await env.MESSAGES_KV.get("messages");
          if (messagesJson) {
            messages = JSON.parse(messagesJson);
          }
        } catch (e) {
          console.error("Error reading messages:", e);
        }
        
        return Response.json(messages, {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
    })
  ]),
]);
