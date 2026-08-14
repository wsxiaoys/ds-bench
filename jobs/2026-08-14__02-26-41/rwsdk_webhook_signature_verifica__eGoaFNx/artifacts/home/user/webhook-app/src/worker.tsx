import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

// Constant-time string comparison helper to prevent timing attacks
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    let diff = 1;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ a.charCodeAt(i);
    }
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Webhook POST handler
async function webhookHandler({ request }: { request: Request }): Promise<Response> {
  const signatureHeader = request.headers.get("X-Signature-256");
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return new Response("Unauthorized", { status: 401 });
  }
  const expectedHex = signatureHeader.slice("sha256=".length);

  // Read raw unmodified body bytes
  let bodyBuffer: ArrayBuffer;
  try {
    bodyBuffer = await request.arrayBuffer();
  } catch (err) {
    return new Response("Bad Request", { status: 400 });
  }

  // Get the WEBHOOK_SECRET environment variable
  const secret = env.WEBHOOK_SECRET;
  if (!secret) {
    console.error("WEBHOOK_SECRET environment variable is not set.");
    return new Response("Internal Server Error", { status: 500 });
  }

  // Compute HMAC-SHA256 signature of the body bytes using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    bodyBuffer
  );

  // Convert signature bytes to lowercase hexadecimal string
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const computedHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  // Compare computed signature against expected signature in constant time
  if (!constantTimeEqual(computedHex, expectedHex)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Decode the body bytes to string
  const decoder = new TextDecoder();
  const bodyText = decoder.decode(bodyBuffer);

  // Parse body as JSON and validate
  let payload: any;
  try {
    payload = JSON.parse(bodyText);
  } catch (err) {
    return new Response("Bad Request", { status: 400 });
  }

  // A valid payload is a JSON object with a string field 'event' and an array field 'items'
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.event !== "string" ||
    !Array.isArray(payload.items)
  ) {
    return new Response("Bad Request", { status: 400 });
  }

  // Respond with HTTP 200 and the specified JSON body
  return Response.json(
    {
      ok: true,
      event: payload.event,
      count: payload.items.length,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/webhook", {
    post: webhookHandler,
  }),
  render(Document, [route("/", Home)]),
]);
