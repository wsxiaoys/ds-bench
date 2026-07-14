import { render, route } from "rwsdk/router";
import { defineApp, type RequestInfo } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

/**
 * Convert a raw ArrayBuffer of bytes to a lowercase hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time comparison of two strings to prevent timing attacks.
 * Always iterates over every character regardless of mismatches.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate to avoid length-based timing leak via short-circuit
    let diff = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Compute the HMAC-SHA256 of `body` using `secret` and return it as a
 * lowercase hex string prefixed with "sha256=".
 */
async function computeSignature(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    encoder.encode(body),
  );
  return "sha256=" + bufferToHex(signatureBuffer);
}

async function handleWebhook({ request }: RequestInfo): Promise<Response> {
  // Read the raw body once so the same bytes are used for both
  // signature verification and JSON parsing.
  const rawBody = await request.text();

  const signatureHeader = request.headers.get("X-Signature-256");
  if (!signatureHeader) {
    return new Response("Missing X-Signature-256 header", { status: 401 });
  }

  const secret: string = (env as unknown as Record<string, string>).WEBHOOK_SECRET;
  const expectedSignature = await computeSignature(secret, rawBody);

  if (!constantTimeEqual(signatureHeader, expectedSignature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  // Signature verified — parse the body as JSON.
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as Record<string, unknown>).event !== "string" ||
    !Array.isArray((payload as Record<string, unknown>).items)
  ) {
    return new Response("Invalid payload shape", { status: 400 });
  }

  const { event, items } = payload as { event: string; items: unknown[] };

  return new Response(JSON.stringify({ ok: true, event, count: items.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/webhook", { post: handleWebhook }),
  render(Document, [route("/", Home)]),
]);
