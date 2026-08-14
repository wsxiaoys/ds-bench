import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

async function seedFixtureIfNeeded() {
  const bucket = env.BUCKET;
  const key = "alphabet.txt";
  const existing = await bucket.head(key);
  if (!existing) {
    await bucket.put(key, "abcdefghijklmnopqrstuvwxyz", {
      httpMetadata: {
        contentType: "text/plain"
      }
    });
  }
}

function parseRange(rangeHeader: string, size: number) {
  let start: number | null = null;
  let end: number | null = null;
  let suffix: number | null = null;

  if (rangeHeader.startsWith("bytes=")) {
    const rangeVal = rangeHeader.slice(6).trim();
    if (rangeVal.includes(",")) {
      return "invalid";
    }
    if (rangeVal.startsWith("-")) {
      const parsed = parseInt(rangeVal.slice(1), 10);
      if (!isNaN(parsed)) {
        suffix = parsed;
      }
    } else if (rangeVal.endsWith("-")) {
      const parsed = parseInt(rangeVal.slice(0, -1), 10);
      if (!isNaN(parsed)) {
        start = parsed;
      }
    } else {
      const parts = rangeVal.split("-");
      if (parts.length === 2) {
        const parsedStart = parseInt(parts[0], 10);
        const parsedEnd = parseInt(parts[1], 10);
        if (!isNaN(parsedStart) && !isNaN(parsedEnd)) {
          start = parsedStart;
          end = parsedEnd;
        }
      }
    }
  }

  let offset = 0;
  let length = size;

  if (suffix !== null) {
    offset = Math.max(0, size - suffix);
    length = Math.min(suffix, size);
  } else if (start !== null && end !== null) {
    if (start >= size || start > end) {
      return null;
    }
    const resolvedEnd = Math.min(end, size - 1);
    offset = start;
    length = resolvedEnd - start + 1;
  } else if (start !== null) {
    if (start >= size) {
      return null;
    }
    offset = start;
    length = size - start;
  } else {
    return "invalid";
  }

  return { offset, length };
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/files/:key", {
      get: async ({ params, request }) => {
        const key = params.key;

        // Seed the fixture if key is "alphabet.txt"
        if (key === "alphabet.txt") {
          await seedFixtureIfNeeded();
        }

        const bucket = env.BUCKET;
        const metadata = await bucket.head(key);
        if (!metadata) {
          return new Response("Not Found", { status: 404 });
        }

        const size = metadata.size;
        const rangeHeader = request.headers.get("Range");

        if (rangeHeader) {
          const parsed = parseRange(rangeHeader, size);
          if (parsed === null) {
            // Unsatisfiable range
            return new Response("", {
              status: 416,
              headers: {
                "Accept-Ranges": "bytes",
                "Content-Range": `bytes */${size}`
              }
            });
          } else if (parsed !== "invalid") {
            const { offset, length } = parsed;
            const object = await bucket.get(key, {
              range: { offset, length }
            });

            if (!object || !object.body) {
              return new Response("Not Found", { status: 404 });
            }

            const headers = new Headers();
            headers.set("Accept-Ranges", "bytes");
            headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${size}`);
            headers.set("Content-Length", length.toString());

            const contentType = object.httpMetadata?.contentType || metadata.httpMetadata?.contentType;
            if (contentType) {
              headers.set("Content-Type", contentType);
            }

            return new Response(object.body, {
              status: 206,
              headers
            });
          }
        }

        // No range header or invalid range header format (fallback to full content)
        const object = await bucket.get(key);
        if (!object || !object.body) {
          return new Response("Not Found", { status: 404 });
        }

        const headers = new Headers();
        headers.set("Accept-Ranges", "bytes");
        headers.set("Content-Length", size.toString());

        const contentType = object.httpMetadata?.contentType || metadata.httpMetadata?.contentType;
        if (contentType) {
          headers.set("Content-Type", contentType);
        }

        return new Response(object.body, {
          status: 200,
          headers
        });
      }
    })
  ]),
]);
