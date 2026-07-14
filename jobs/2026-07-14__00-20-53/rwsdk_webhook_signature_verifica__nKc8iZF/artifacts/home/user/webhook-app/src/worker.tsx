import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

const toHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
};

/**
 * Compares two equal-length strings in constant time so that an attacker
 * cannot infer information about the expected value from the comparison
 * duration. Returns false immediately when the lengths differ.
 */
const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

const verifySignature = async (
  rawBody: ArrayBuffer,
  headerValue: string,
  secret: string,
): Promise<boolean> => {
  const expectedPrefix = "sha256=";
  if (!headerValue.startsWith(expectedPrefix)) {
    return false;
  }
  const providedHex = headerValue.slice(expectedPrefix.length).toLowerCase();

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, rawBody);
  const computedHex = toHex(signature);

  // Constant-time comparison over equal-length hex strings.
  return constantTimeEqual(computedHex, providedHex);
};

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const unauthorized = (): Response =>
  new Response("Unauthorized", { status: 401 });

const webhookPost = async ({ request }: { request: Request }) => {
  const signatureHeader = request.headers.get("X-Signature-256");
  if (!signatureHeader) {
    return unauthorized();
  }

  const secret = env.WEBHOOK_SECRET;
  if (typeof secret !== "string" || secret.length === 0) {
    return unauthorized();
  }

  // Read the raw bytes once and reuse them for verification and parsing so
  // the signed content matches what we parse.
  const rawBody = await request.arrayBuffer();

  const isValid = await verifySignature(rawBody, signatureHeader, secret);
  if (!isValid) {
    return unauthorized();
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { event?: unknown }).event !== "string" ||
    !Array.isArray((payload as { items?: unknown }).items)
  ) {
    return new Response("Bad Request", { status: 400 });
  }

  const { event, items } = payload as {
    event: string;
    items: unknown[];
  };

  return jsonResponse({ ok: true, event, count: items.length }, 200);
};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/webhook", {
      post: webhookPost,
    }),
  ]),
]);