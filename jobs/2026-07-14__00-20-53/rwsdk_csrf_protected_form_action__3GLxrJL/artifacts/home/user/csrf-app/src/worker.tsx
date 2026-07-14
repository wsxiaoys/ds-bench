import { render, route, type RouteMiddleware } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {
  /**
   * The freshly-generated CSRF token for this GET / request. Set by
   * `issueCsrfToken` so the page component can render it as a hidden
   * form field.
   */
  csrfToken?: string;

  /**
   * The parsed application/x-www-form-urlencoded body of a POST /submit
   * request. Set by `validateCsrf` so the downstream `submitMessage`
   * middleware does not need to consume the request body a second time
   * (which would fail because the body has already been read).
   */
  parsedFormData?: FormData;
};

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_FIELD_NAME = "csrf_token";
const MESSAGES_INDEX_KEY = "messages:index";

/**
 * Parse a Cookie header into a key/value map.
 */
function parseCookieHeader(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (name) {
      cookies[name] = value;
    }
  }
  return cookies;
}

/**
 * Generate a cryptographically strong CSRF token.
 *
 * Uses Web Crypto's getRandomValues to fill 32 bytes, encoded as 64 hex
 * characters. The resulting value is suitable for the double-submit-cookie
 * pattern: it is unguessable, has high entropy, and contains no characters
 * that need escaping inside a Set-Cookie value or HTML attribute.
 */
function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let token = "";
  for (let i = 0; i < bytes.length; i++) {
    token += bytes[i].toString(16).padStart(2, "0");
  }
  return token;
}

/**
 * Build the Set-Cookie header value for a freshly-issued CSRF token.
 *
 * SameSite=Lax is used so that top-level navigations (including the
 * standard form POST that the browser does from the rendered page) send
 * the cookie back, while keeping it from being attached to cross-site
 * sub-requests such as those forged by an attacker page.
 */
function buildCsrfCookie(token: string): string {
  return `${CSRF_COOKIE_NAME}=${token}; Path=/; SameSite=Lax`;
}

/**
 * Middleware that issues a new CSRF token on GET /.
 *
 * The token is:
 *   1. stored on `ctx.csrfToken` so the page component can render it in the
 *      hidden form field, AND
 *   2. sent to the browser as a `csrf_token` cookie so the browser will
 *      include it on the subsequent POST /submit.
 *
 * Because this middleware runs on every GET /, a new, different token is
 * generated per request.
 */
const issueCsrfToken: RouteMiddleware = ({ ctx, response }) => {
  const token = generateCsrfToken();
  ctx.csrfToken = token;
  response.headers.append("Set-Cookie", buildCsrfCookie(token));
};

/**
 * Middleware that enforces the double-submit-cookie CSRF check on
 * POST /submit. Runs BEFORE any persistence so a failed validation cannot
 * leak state.
 *
 * Validation rule:
 *   - the `csrf_token` form field is present, AND
 *   - the `csrf_token` cookie is present, AND
 *   - the two values are exactly equal.
 *
 * On failure, returns 403 and does NOT persist anything.
 *
 * The parsed FormData is stashed on `ctx.parsedFormData` so the
 * downstream `submitMessage` middleware can reuse it without
 * re-consuming the request body.
 */
const validateCsrf: RouteMiddleware = async ({ request, ctx }) => {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const formToken = formData.get(CSRF_FIELD_NAME);
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const cookieToken = cookies[CSRF_COOKIE_NAME];

  if (
    typeof formToken !== "string" ||
    formToken.length === 0 ||
    typeof cookieToken !== "string" ||
    cookieToken.length === 0 ||
    formToken !== cookieToken
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  ctx.parsedFormData = formData;
};

/**
 * POST /submit handler.
 *
 * The CSRF check is performed by the `validateCsrf` middleware that runs
 * immediately before this handler. If validation fails, this handler
 * never runs.
 */
const submitMessage: RouteMiddleware = async ({ ctx }) => {
  const formData = ctx.parsedFormData;
  if (!formData) {
    // Defensive: should be unreachable because `validateCsrf` always
    // either sets this or short-circuits with 403.
    return new Response("Bad Request", { status: 400 });
  }

  const message = formData.get("message");
  if (typeof message !== "string" || message.length === 0) {
    return new Response("Bad Request: missing message", { status: 400 });
  }

  // Append the message to the durable KV-backed log. We use a counter key
  // so messages come back in submission order.
  const indexValue = (await env.MESSAGES.get(MESSAGES_INDEX_KEY)) ?? "0";
  const nextIndex = parseInt(indexValue, 10) + 1;

  await Promise.all([
    env.MESSAGES.put(MESSAGES_INDEX_KEY, String(nextIndex)),
    env.MESSAGES.put(`messages:${nextIndex}`, message),
  ]);

  return new Response("OK", { status: 200 });
};

/**
 * GET /messages handler.
 *
 * Returns all persisted message strings, in submission order
 * (oldest first), as a JSON array.
 */
const listMessages: RouteMiddleware = async () => {
  const indexValue = (await env.MESSAGES.get(MESSAGES_INDEX_KEY)) ?? "0";
  const total = parseInt(indexValue, 10);

  if (total <= 0) {
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Read messages in parallel for fewer round-trips.
  const reads: Promise<string | null>[] = [];
  for (let i = 1; i <= total; i++) {
    reads.push(env.MESSAGES.get(`messages:${i}`));
  }
  const values = await Promise.all(reads);
  const messages = values.filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );

  return new Response(JSON.stringify(messages), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export default defineApp([
  setCommonHeaders(),
  render(Document, [
    route("/", [issueCsrfToken, Home]),
    route("/submit", {
      post: [validateCsrf, submitMessage],
    }),
    route("/messages", listMessages),
  ]),
]);
