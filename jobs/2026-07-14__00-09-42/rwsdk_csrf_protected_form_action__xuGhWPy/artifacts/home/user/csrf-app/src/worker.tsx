import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { HomePage } from "@/app/pages/home";

export type AppContext = {
  env: Env;
};

// Helper: parse cookies from a Cookie header string
function parseCookies(cookieHeader: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    map.set(part.slice(0, idx).trim(), part.slice(idx + 1).trim());
  }
  return map;
}

// KV key under which the ordered list of messages is stored as JSON
const MESSAGES_KEY = "messages";

// Module-level env reference — CF Workers execute one request at a time per isolate,
// so storing env here per-fetch is safe.
let _env: Env;

const _app = defineApp([
  setCommonHeaders(),

  // Global middleware: expose env on ctx for all route handlers
  ({ ctx }: any) => {
    (ctx as AppContext).env = _env;
  },

  // GET / — render the CSRF-protected form, set csrf_token cookie
  route("/", [
    ({ request, response, ctx }: any) => {
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      const token = crypto.randomUUID();
      // Stash the token on ctx so the React page can read it
      ctx.csrfToken = token;
      // Set the double-submit cookie (NOT HttpOnly so we follow double-submit pattern)
      response.headers.append(
        "Set-Cookie",
        `csrf_token=${token}; Path=/; SameSite=Strict`,
      );
    },
    ({ ctx }: any) => <HomePage csrfToken={ctx.csrfToken} />,
  ]),

  // POST /submit — validate CSRF then persist message
  route("/submit", async ({ request, ctx }: any) => {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    const formToken = formData.get("csrf_token");
    const message = formData.get("message");

    // Parse cookie header
    const cookies = parseCookies(request.headers.get("cookie"));
    const cookieToken = cookies.get("csrf_token");

    // Double-submit-cookie validation: both present and equal
    if (
      typeof formToken !== "string" ||
      !formToken ||
      !cookieToken ||
      formToken !== cookieToken
    ) {
      return new Response("Forbidden", { status: 403 });
    }

    // Persist message in KV (oldest first)
    const kv: KVNamespace = (ctx as AppContext).env.MESSAGES_KV;
    const messageStr = typeof message === "string" ? message : "";
    const existing = await kv.get(MESSAGES_KEY);
    const messages: string[] = existing ? JSON.parse(existing) : [];
    messages.push(messageStr);
    await kv.put(MESSAGES_KEY, JSON.stringify(messages));

    return new Response("OK", { status: 200 });
  }),

  // GET /messages — return all persisted messages as JSON array
  route("/messages", async ({ ctx }: any) => {
    const kv: KVNamespace = (ctx as AppContext).env.MESSAGES_KV;
    const existing = await kv.get(MESSAGES_KEY);
    const messages: string[] = existing ? JSON.parse(existing) : [];

    return new Response(JSON.stringify(messages), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),

  render(Document, []),
]);

// Wrap the fetch handler so we can capture `env` before routing begins
export default {
  ..._app,
  fetch(request: Request, env: Env, cf: ExecutionContext): Promise<Response> {
    _env = env;
    return _app.fetch(request, env, cf);
  },
};
