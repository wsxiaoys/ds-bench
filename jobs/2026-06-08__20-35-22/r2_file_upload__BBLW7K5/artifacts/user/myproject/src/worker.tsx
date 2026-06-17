import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function uploadFile({ request }: { request: Request }) {
  const formData = await request.formData();
  const fileField = formData.get("file");

  if (!fileField || !(fileField instanceof File)) {
    return Response.json({ error: "No file field provided" }, { status: 400 });
  }

  const file = fileField as File;
  const bytes = await file.arrayBuffer();
  const sha256Hex = await sha256(bytes);

  const filename = file.name;
  const lastDotIndex = filename.lastIndexOf(".");
  const ext = lastDotIndex > 0 ? filename.slice(lastDotIndex + 1) : "";

  const key = ext ? `uploads/${sha256Hex}.${ext}` : `uploads/${sha256Hex}`;
  const contentType = file.type || "application/octet-stream";

  await env.BUCKET.put(key, bytes, {
    httpMetadata: {
      contentType,
    },
  });

  return Response.json(
    {
      key,
      size: bytes.byteLength,
      contentType,
      sha256: sha256Hex,
    },
    { status: 201 }
  );
}

async function listFiles() {
  const allObjects: R2Object[] = [];
  let cursor: string | undefined;

  do {
    const listed = await env.BUCKET.list({ prefix: "uploads/", cursor });
    allObjects.push(...listed.objects);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  const objects = allObjects.map((obj) => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded.toISOString(),
  }));

  return Response.json({ objects });
}

async function getFile({
  params,
}: {
  params: Record<string, string>;
}) {
  const key = decodeURIComponent(params.key);
  const object = await env.BUCKET.get(key);

  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType || "application/octet-stream"
  );
  headers.set("Content-Length", object.size.toString());

  return new Response(object.body, { headers });
}

async function deleteFile({
  params,
}: {
  params: Record<string, string>;
}) {
  const key = decodeURIComponent(params.key);
  const object = await env.BUCKET.get(key);

  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  await env.BUCKET.delete(key);
  return new Response(null, { status: 204 });
}

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/api/files", {
    get: listFiles,
    post: uploadFile,
  }),
  route("/api/files/:key", {
    get: getFile,
    delete: deleteFile,
  }),
  render(Document, [route("/", Home)]),
]);