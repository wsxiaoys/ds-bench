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
  route("/api/files", {
    post: async ({ request }) => {
      const formData = await request.formData().catch(() => null);
      if (!formData) {
        return new Response("Bad Request", { status: 400 });
      }

      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return new Response("Bad Request", { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const digestBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const digestArray = Array.from(new Uint8Array(digestBuffer));
      const sha256Hex = digestArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      let ext = "";
      if (file.name) {
        const lastDot = file.name.lastIndexOf(".");
        if (
          lastDot !== -1 &&
          lastDot !== 0 &&
          lastDot !== file.name.length - 1
        ) {
          ext = "." + file.name.substring(lastDot + 1);
        }
      }

      const key = `uploads/${sha256Hex}${ext}`;
      const contentType = file.type || "application/octet-stream";
      const size = arrayBuffer.byteLength;

      await env.BUCKET.put(key, arrayBuffer, {
        httpMetadata: {
          contentType: contentType,
        },
      });

      return Response.json(
        {
          key,
          size,
          contentType,
          sha256: sha256Hex,
        },
        { status: 201 },
      );
    },
    get: async () => {
      const listed = await env.BUCKET.list({ prefix: "uploads/" });
      const objects = listed.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
      }));
      return Response.json({ objects });
    },
  }),
  route("/api/files/:key", {
    get: async ({ params }) => {
      const decodedKey = decodeURIComponent(params.key);
      const object = await env.BUCKET.get(decodedKey);
      if (!object) {
        return new Response("Not Found", { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Content-Length", object.size.toString());

      return new Response(object.body, {
        headers,
      });
    },
    delete: async ({ params }) => {
      const decodedKey = decodeURIComponent(params.key);
      const head = await env.BUCKET.head(decodedKey);
      if (!head) {
        return new Response("Not Found", { status: 404 });
      }
      await env.BUCKET.delete(decodedKey);
      return new Response(null, { status: 204 });
    },
  }),
  render(Document, [route("/", Home)]),
]);
