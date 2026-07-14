import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

/**
 * Compute the HMAC-SHA256 of `body` using `secret` as the key and return the
 * digest as a lowercase hex string. Uses the Web Crypto API available in the
 * Cloudflare Workers runtime.
 */
async function computeSignature(body: ArrayBuffer, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, body);

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time comparison of two strings. Always inspects every byte regardless
 * of where a mismatch occurs to avoid leaking timing information.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/webhook", {
      post: async ({ request }) => {
        const secret = env.WEBHOOK_SECRET;

        if (!secret) {
          return new Response("Internal Server Error", { status: 500 });
        }

        const signatureHeader = request.headers.get("X-Signature-256");

        if (!signatureHeader) {
          return new Response("Unauthorized", { status: 401 });
        }

        // Read the raw body once and reuse it for both signature verification
        // and JSON parsing so the signed content matches what we parse.
        const rawBody = await request.arrayBuffer();

        const computed = await computeSignature(rawBody, secret);

        // The header is formatted as `sha256=<hex>`.
        const expected = signatureHeader.startsWith("sha256=")
          ? signatureHeader.slice("sha256=".length)
          : signatureHeader;

        if (!timingSafeEqual(computed, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        // Signature is valid – parse the body as JSON.
        let payload: { event?: string; items?: unknown[] };
        try {
          payload = JSON.parse(new TextDecoder().decode(rawBody));
        } catch {
          return new Response("Bad Request", { status: 400 });
        }

        if (
          typeof payload.event !== "string" ||
          !Array.isArray(payload.items)
        ) {
          return new Response("Bad Request", { status: 400 });
        }

        return Response.json(
          { ok: true, event: payload.event, count: payload.items.length },
          { headers: { "Content-Type": "application/json" } },
        );
      },
    }),
  ]),
]);
