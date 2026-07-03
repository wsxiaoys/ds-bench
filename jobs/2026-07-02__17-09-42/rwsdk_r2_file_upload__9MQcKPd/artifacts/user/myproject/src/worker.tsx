import { route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

export type AppContext = {};

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx === -1 || idx === filename.length - 1) {
    return "";
  }
  return filename.slice(idx + 1);
}

async function listAllObjects(prefix: string): Promise<R2Object[]> {
  const all: R2Object[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await env.BUCKET.list({ prefix, cursor });
    all.push(...page.objects);
    if (!page.truncated) {
      break;
    }
    cursor = page.cursor;
  }
  return all;
}

export default defineApp([
  route("/api/files", {
    get: async () => {
      const objects = await listAllObjects("uploads/");
      return jsonResponse({
        objects: objects.map((o) => ({
          key: o.key,
          size: o.size,
          uploaded: o.uploaded.toISOString(),
        })),
      });
    },
    post: async ({ request }) => {
      const contentType = request.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("multipart/form-data")) {
        return jsonResponse({ error: "Expected multipart/form-data" }, 400);
      }

      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return jsonResponse({ error: "Invalid multipart/form-data body" }, 400);
      }

      const file = formData.get("file");
      if (!file || typeof file === "string") {
        return jsonResponse({ error: "Missing 'file' field" }, 400);
      }

      const fileObj = file as File;
      const bytes = await fileObj.arrayBuffer();
      const sha256 = await sha256Hex(bytes);
      const ext = getExtension(fileObj.name);
      const key = ext ? `uploads/${sha256}.${ext}` : `uploads/${sha256}`;

      await env.BUCKET.put(key, bytes, {
        httpMetadata: {
          contentType: fileObj.type || "application/octet-stream",
        },
      });

      return jsonResponse(
        {
          key,
          size: bytes.byteLength,
          contentType: fileObj.type || "application/octet-stream",
          sha256,
        },
        201,
      );
    },
  }),
  route("/api/files/:key", {
    get: async ({ params }) => {
      let key: string;
      try {
        key = decodeURIComponent(params.key);
      } catch {
        return jsonResponse({ error: "Invalid key encoding" }, 400);
      }

      const object = await env.BUCKET.get(key);
      if (object === null) {
        return jsonResponse({ error: "Not found" }, 404);
      }

      const headers = new Headers();
      const contentType =
        (object.httpMetadata?.contentType as string | undefined) ??
        "application/octet-stream";
      headers.set("Content-Type", contentType);
      headers.set("Content-Length", String(object.size));

      return new Response(object.body, { status: 200, headers });
    },
    delete: async ({ params }) => {
      let key: string;
      try {
        key = decodeURIComponent(params.key);
      } catch {
        return jsonResponse({ error: "Invalid key encoding" }, 400);
      }

      const object = await env.BUCKET.head(key);
      if (object === null) {
        return jsonResponse({ error: "Not found" }, 404);
      }

      await env.BUCKET.delete(key);
      return new Response(null, { status: 204 });
    },
  }),
]);
