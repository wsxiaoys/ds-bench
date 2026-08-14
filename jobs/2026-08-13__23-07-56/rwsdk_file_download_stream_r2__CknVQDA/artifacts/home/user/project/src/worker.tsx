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
  route("/files/:key", {
    get: async ({ params, request }) => {
      const key = params.key;
      if (!key) {
        return new Response("Not Found", { status: 404 });
      }

      // Seed the bucket lazily inside the request lifecycle
      if (key === "alphabet.txt") {
        const existing = await env.MY_BUCKET.head(key);
        if (!existing) {
          await env.MY_BUCKET.put(key, "abcdefghijklmnopqrstuvwxyz", {
            httpMetadata: {
              contentType: "text/plain",
            },
          });
        }
      }

      // First check if the object exists
      const meta = await env.MY_BUCKET.head(key);
      if (!meta) {
        return new Response("Not Found", { status: 404 });
      }

      const rangeHeader = request.headers.get("Range");
      let parsedRange = null;

      if (rangeHeader) {
        parsedRange = parseRange(rangeHeader, meta.size);
      }

      let obj;
      if (parsedRange) {
        obj = await env.MY_BUCKET.get(key, { range: parsedRange.r2Range });
      } else {
        obj = await env.MY_BUCKET.get(key);
      }

      if (!obj) {
        return new Response("Not Found", { status: 404 });
      }

      const headers = new Headers();
      headers.set("Accept-Ranges", "bytes");
      const contentType = obj.httpMetadata?.contentType || "application/octet-stream";
      headers.set("Content-Type", contentType);

      if (parsedRange) {
        const { start, end } = parsedRange;
        const contentLength = end - start + 1;
        headers.set("Content-Length", contentLength.toString());
        headers.set("Content-Range", `bytes ${start}-${end}/${meta.size}`);
        return new Response(obj.body, { status: 206, headers });
      } else {
        headers.set("Content-Length", obj.size.toString());
        return new Response(obj.body, { status: 200, headers });
      }
    },
  }),
  render(Document, [route("/", Home)]),
]);

function parseRange(rangeHeader: string, totalSize: number) {
  if (!rangeHeader.startsWith("bytes=")) {
    return null;
  }
  const parts = rangeHeader.substring(6).split("-");
  if (parts.length !== 2) {
    return null;
  }
  const startStr = parts[0].trim();
  const endStr = parts[1].trim();

  // Case 3: bytes=-suffix (last N bytes)
  if (startStr === "" && endStr !== "") {
    const suffix = parseInt(endStr, 10);
    if (isNaN(suffix) || suffix <= 0) {
      return null;
    }
    const start = Math.max(0, totalSize - suffix);
    const end = totalSize - 1;
    return {
      start,
      end,
      r2Range: { suffix }
    };
  }

  // Case 2: bytes=start- (open-ended)
  if (startStr !== "" && endStr === "") {
    const start = parseInt(startStr, 10);
    if (isNaN(start) || start < 0 || start >= totalSize) {
      return null;
    }
    const end = totalSize - 1;
    return {
      start,
      end,
      r2Range: { offset: start }
    };
  }

  // Case 1: bytes=start-end (inclusive range)
  if (startStr !== "" && endStr !== "") {
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    if (isNaN(start) || isNaN(end) || start < 0 || end < 0 || start > end) {
      return null;
    }
    if (start >= totalSize) {
      return null;
    }
    const actualEnd = Math.min(end, totalSize - 1);
    const length = actualEnd - start + 1;
    return {
      start,
      end: actualEnd,
      r2Range: { offset: start, length }
    };
  }

  return null;
}
