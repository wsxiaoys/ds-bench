import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

async function handleUploadFile({ request }: { request: Request }) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json({ error: "No file field present" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();

    // Calculate SHA-256 hash of the file bytes
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Infer extension from filename
    const filename = file.name;
    let ext = "";
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex > 0 && lastDotIndex < filename.length - 1) {
      ext = filename.substring(lastDotIndex + 1);
    }

    const key = ext ? `uploads/${hashHex}.${ext}` : `uploads/${hashHex}`;

    // Put file in R2 BUCKET
    await env.BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
    });

    return Response.json(
      {
        key,
        size: arrayBuffer.byteLength,
        contentType: file.type || "application/octet-stream",
        sha256: hashHex,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Upload error:", error);
    return Response.json(
      { error: error.message || "Upload failed" },
      { status: 500 },
    );
  }
}

async function handleListFiles() {
  try {
    // List every object under the `uploads/` prefix.
    const listResult = await env.BUCKET.list({ prefix: "uploads/" });

    const objects = listResult.objects.map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded.toISOString(),
    }));

    return Response.json({ objects }, { status: 200 });
  } catch (error: any) {
    console.error("List files error:", error);
    return Response.json(
      { error: error.message || "Failed to list files" },
      { status: 500 },
    );
  }
}

async function handleGetFile({ params }: { params: { $0: string } }) {
  try {
    const keyParam = params.$0;
    if (!keyParam) {
      return Response.json({ error: "Missing key" }, { status: 400 });
    }

    // Decode URL-encoded key
    const key = decodeURIComponent(keyParam);

    const object = await env.BUCKET.get(key);
    if (!object) {
      return Response.json({ error: "Not Found" }, { status: 404 });
    }

    const headers = new Headers();
    if (object.httpMetadata?.contentType) {
      headers.set("Content-Type", object.httpMetadata.contentType);
    } else {
      headers.set("Content-Type", "application/octet-stream");
    }
    headers.set("Content-Length", object.size.toString());

    return new Response(object.body, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("Get file error:", error);
    return Response.json(
      { error: error.message || "Failed to retrieve file" },
      { status: 500 },
    );
  }
}

async function handleDeleteFile({ params }: { params: { $0: string } }) {
  try {
    const keyParam = params.$0;
    if (!keyParam) {
      return Response.json({ error: "Missing key" }, { status: 400 });
    }

    const key = decodeURIComponent(keyParam);

    // Check if the key exists before deleting
    const object = await env.BUCKET.head(key);
    if (!object) {
      return Response.json({ error: "Not Found" }, { status: 404 });
    }

    await env.BUCKET.delete(key);

    return new Response(null, { status: 204 });
  } catch (error: any) {
    console.error("Delete file error:", error);
    return Response.json(
      { error: error.message || "Failed to delete file" },
      { status: 500 },
    );
  }
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/api/files", {
    get: handleListFiles,
    post: handleUploadFile,
  }),
  route("/api/files/*", {
    get: handleGetFile,
    delete: handleDeleteFile,
  }),
  render(Document, [route("/", Home)]),
]);
