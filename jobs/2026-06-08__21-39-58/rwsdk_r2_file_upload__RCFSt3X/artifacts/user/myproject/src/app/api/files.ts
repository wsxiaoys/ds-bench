import { route, RouteMiddleware } from "rwsdk/router";
import { env } from "cloudflare:workers";

// Helper: compute SHA-256 hex digest from raw bytes
async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Helper: extract file extension from a filename, without the dot.
// Returns empty string if no extension.
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === 0) return "";
  return filename.slice(lastDot + 1);
}

// POST /api/files — upload a file
const postUpload: RouteMiddleware = async ({ request }) => {
  const contentType = request.headers.get("Content-Type") || "";

  if (!contentType.includes("multipart/form-data")) {
    return new Response(
      JSON.stringify({ error: "Expected multipart/form-data" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return new Response(
      JSON.stringify({ error: 'Missing "file" field' }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const bytes = await file.arrayBuffer();
  const sha256 = await sha256Hex(bytes);
  const ext = getExtension(file.name);
  const key = ext ? `uploads/${sha256}.${ext}` : `uploads/${sha256}`;

  await env.BUCKET.put(key, bytes, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

  return new Response(
    JSON.stringify({
      key,
      size: bytes.byteLength,
      contentType: file.type || "application/octet-stream",
      sha256,
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};

// GET /api/files/:key — download a file
const getFile: RouteMiddleware = async ({ params }) => {
  const key = decodeURIComponent(params.$0);

  const object = await env.BUCKET.get(key);
  if (object === null) {
    return new Response(
      JSON.stringify({ error: "Not Found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const headers = new Headers();
  if (object.httpMetadata?.contentType) {
    headers.set("Content-Type", object.httpMetadata.contentType);
  }
  headers.set("Content-Length", String(object.size));

  return new Response(object.body, { status: 200, headers });
};

// DELETE /api/files/:key — delete a file
const deleteFile: RouteMiddleware = async ({ params }) => {
  const key = decodeURIComponent(params.$0);

  // Check if the object exists first
  const object = await env.BUCKET.get(key);
  if (object === null) {
    return new Response(
      JSON.stringify({ error: "Not Found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  await env.BUCKET.delete(key);

  return new Response(null, { status: 204 });
};

// GET /api/files — list all objects under uploads/ prefix
const listFiles: RouteMiddleware = async () => {
  const objects: Array<{ key: string; size: number; uploaded: string }> = [];

  const listed = await env.BUCKET.list({ prefix: "uploads/" });
  for (const obj of listed.objects) {
    objects.push({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded.toISOString(),
    });
  }

  return new Response(
    JSON.stringify({ objects }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const fileRoutes = [
  route("/api/files/", {
    get: listFiles,
    post: postUpload,
  }),
  route("/api/files/*", {
    get: getFile,
    delete: deleteFile,
  }),
];
