import { route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

export type AppContext = {};

// Helper: compute SHA-256 hex digest of an ArrayBuffer
async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Helper: extract file extension from a filename (without the dot)
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === 0) return "";
  return filename.slice(lastDot + 1);
}

export default defineApp([
  // /api/files — list and upload
  route("/api/files", {
    // POST /api/files — upload a file
    post: async ({ request }) => {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid form data" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return new Response(JSON.stringify({ error: "Missing file field" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const arrayBuffer = await file.arrayBuffer();
      const sha256 = await sha256Hex(arrayBuffer);
      const ext = getExtension(file.name);
      const key = ext ? `uploads/${sha256}.${ext}` : `uploads/${sha256}`;
      const contentType = file.type || "application/octet-stream";
      const size = arrayBuffer.byteLength;

      await (env as Env).BUCKET.put(key, arrayBuffer, {
        httpMetadata: { contentType },
      });

      return new Response(JSON.stringify({ key, size, contentType, sha256 }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    },

    // GET /api/files — list all objects under uploads/
    get: async () => {
      const listed = await (env as Env).BUCKET.list({ prefix: "uploads/" });
      const objects = listed.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
      }));

      return new Response(JSON.stringify({ objects }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  }),

  // /api/files/:key — retrieve and delete individual files
  route("/api/files/:key", {
    // GET /api/files/:key — retrieve a stored file
    get: async ({ params }) => {
      const key = decodeURIComponent(params.key);
      const object = await (env as Env).BUCKET.get(key);

      if (!object) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const headers: Record<string, string> = {
        "Content-Length": String(object.size),
      };
      if (object.httpMetadata?.contentType) {
        headers["Content-Type"] = object.httpMetadata.contentType;
      }

      return new Response(object.body, { status: 200, headers });
    },

    // DELETE /api/files/:key — delete a stored file
    delete: async ({ params }) => {
      const key = decodeURIComponent(params.key);
      const existing = await (env as Env).BUCKET.head(key);

      if (!existing) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      await (env as Env).BUCKET.delete(key);

      return new Response(null, { status: 204 });
    },
  }),
]);
