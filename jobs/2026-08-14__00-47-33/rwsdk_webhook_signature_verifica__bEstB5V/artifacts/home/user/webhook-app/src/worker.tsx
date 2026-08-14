import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

function constantTimeCompare(a: string, b: string): boolean {
  let result = 0;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const codeA = i < a.length ? a.charCodeAt(i) : 0;
    const codeB = i < b.length ? b.charCodeAt(i) : 0;
    result |= codeA ^ codeB;
  }
  return result === 0 && a.length === b.length;
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/webhook", {
    post: async ({ request }) => {
      const sigHeader = request.headers.get("X-Signature-256");
      if (!sigHeader || !sigHeader.startsWith("sha256=")) {
        return new Response("Unauthorized", { status: 401 });
      }
      const expectedHex = sigHeader.slice(7);

      const bodyBuffer = await request.arrayBuffer();
      const encoder = new TextEncoder();
      const keyData = encoder.encode(env.WEBHOOK_SECRET);
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        bodyBuffer
      );
      const hashArray = Array.from(new Uint8Array(signatureBuffer));
      const computedHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      if (!constantTimeCompare(computedHex, expectedHex)) {
        return new Response("Unauthorized", { status: 401 });
      }

      const decoder = new TextDecoder("utf-8");
      const bodyText = decoder.decode(bodyBuffer);

      let payload: any;
      try {
        payload = JSON.parse(bodyText);
      } catch (e) {
        return new Response("Bad Request: Invalid JSON", { status: 400 });
      }

      if (
        !payload ||
        typeof payload !== "object" ||
        typeof payload.event !== "string" ||
        !Array.isArray(payload.items)
      ) {
        return new Response("Bad Request: Invalid payload schema", { status: 400 });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          event: payload.event,
          count: payload.items.length,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    },
  }),
  render(Document, [route("/", Home)]),
]);
