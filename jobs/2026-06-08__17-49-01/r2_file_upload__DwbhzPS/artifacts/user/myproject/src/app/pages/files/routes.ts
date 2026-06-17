import { route } from "rwsdk/router";
import { env } from "cloudflare:workers";

async function getFileKeyAndHash(file: File): Promise<{ key: string; sha256: string }> {
  const bytes = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const sha256 = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  const filename = file.name || "";
  const lastDotIndex = filename.lastIndexOf(".");
  let ext = "";
  if (lastDotIndex !== -1 && lastDotIndex > 0 && lastDotIndex < filename.length - 1) {
    ext = filename.slice(lastDotIndex + 1);
  }

  const key = ext ? `uploads/${sha256}.${ext}` : `uploads/${sha256}`;
  return { key, sha256 };
}

export const fileApiRoutes = [
  route("/api/files", {
    post: async ({ request }) => {
      try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
          return Response.json({ error: "Missing file" }, { status: 400 });
        }

        const { key, sha256 } = await getFileKeyAndHash(file);
        const bytes = await file.arrayBuffer();

        await env.BUCKET.put(key, bytes, {
          httpMetadata: {
            contentType: file.type || "application/octet-stream",
          },
        });

        return Response.json(
          {
            key,
            size: file.size,
            contentType: file.type || "application/octet-stream",
            sha256,
          },
          { status: 201 }
        );
      } catch (error: any) {
        return Response.json({ error: error.message || "Upload failed" }, { status: 400 });
      }
    },
    get: async () => {
      try {
        const listResult = await env.BUCKET.list({ prefix: "uploads/" });
        const objects = (listResult.objects || []).map((obj) => ({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded.toISOString(),
        }));
        return Response.json({ objects });
      } catch (error: any) {
        return Response.json({ error: error.message || "Failed to list files" }, { status: 500 });
      }
    },
  }),

  route("/api/files/:key", {
    get: async ({ params }) => {
      try {
        if (!params || !params.key) {
          return Response.json({ error: "Missing key parameter" }, { status: 400 });
        }
        const key = decodeURIComponent(params.key);
        const object = await env.BUCKET.get(key);

        if (!object) {
          return Response.json({ error: "File not found" }, { status: 404 });
        }

        const headers = new Headers();
        headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
        headers.set("Content-Length", object.size.toString());

        return new Response(object.body, {
          status: 200,
          headers,
        });
      } catch (error: any) {
        return Response.json({ error: error.message || "Failed to retrieve file" }, { status: 500 });
      }
    },
    delete: async ({ params }) => {
      try {
        if (!params || !params.key) {
          return Response.json({ error: "Missing key parameter" }, { status: 400 });
        }
        const key = decodeURIComponent(params.key);
        
        // R2 delete is idempotent and does not fail if key doesn't exist,
        // but we need to return 404 if the key does not exist.
        const existing = await env.BUCKET.head(key);
        if (!existing) {
          return Response.json({ error: "File not found" }, { status: 404 });
        }

        await env.BUCKET.delete(key);
        return new Response(null, { status: 204 });
      } catch (error: any) {
        return Response.json({ error: error.message || "Failed to delete file" }, { status: 500 });
      }
    },
  }),
];
