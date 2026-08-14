import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Perform dummy operations to match the loop time of a matching comparison
    let mismatch = 0;
    for (let i = 0; i < 64; i++) {
      mismatch |= a.charCodeAt(i) ^ a.charCodeAt(i);
    }
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function verifySignature(request: Request, bodyBuffer: ArrayBuffer): Promise<boolean> {
  const signatureHeader = request.headers.get("X-Signature-256");
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const receivedHex = signatureHeader.slice(7).toLowerCase();

  const secret = (env as any).WEBHOOK_SECRET as string | undefined;
  if (!secret) {
    console.error("WEBHOOK_SECRET environment variable is not defined");
    return false;
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    {
      name: "HMAC",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    bodyBuffer
  );

  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return constantTimeCompare(computedHex, receivedHex);
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
        let bodyBuffer: ArrayBuffer;
        try {
          bodyBuffer = await request.arrayBuffer();
        } catch (e) {
          return new Response("Bad Request", { status: 400 });
        }

        const isSignatureValid = await verifySignature(request, bodyBuffer);
        if (!isSignatureValid) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: any;
        try {
          const decoder = new TextDecoder();
          const bodyText = decoder.decode(bodyBuffer);
          payload = JSON.parse(bodyText);
        } catch (e) {
          return new Response("Bad Request", { status: 400 });
        }

        if (
          !payload ||
          typeof payload !== "object" ||
          typeof payload.event !== "string" ||
          !Array.isArray(payload.items)
        ) {
          return new Response("Bad Request", { status: 400 });
        }

        const responseBody = {
          ok: true,
          event: payload.event,
          count: payload.items.length,
        };

        return new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      },
    }),
  ]),
]);
