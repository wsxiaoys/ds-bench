import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

// Helper to parse Range header
function parseRange(rangeHeader: string, totalSize: number) {
  const match = rangeHeader.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  const startStr = match[1];
  const endStr = match[2];

  let start: number;
  let end: number;

  if (startStr === "" && endStr !== "") {
    // bytes=-suffix
    const suffix = parseInt(endStr, 10);
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else if (startStr !== "" && endStr === "") {
    // bytes=start-
    start = parseInt(startStr, 10);
    end = totalSize - 1;
  } else if (startStr !== "" && endStr !== "") {
    // bytes=start-end
    start = parseInt(startStr, 10);
    end = parseInt(endStr, 10);
  } else {
    return null;
  }

  // Validate range
  if (start < 0 || start >= totalSize || end < start) {
    return null; // unsatisfiable
  }

  // Clamp end
  if (end >= totalSize) {
    end = totalSize - 1;
  }

  return { start, end };
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/files/:key", {
    get: async ({ request, params }) => {
      const key = params.key;

      // Lazily seed alphabet.txt if it is missing
      const alphabetExists = await env.BUCKET.head("alphabet.txt");
      if (!alphabetExists) {
        await env.BUCKET.put("alphabet.txt", "abcdefghijklmnopqrstuvwxyz", {
          httpMetadata: { contentType: "text/plain" },
        });
      }

      // Check if the requested key exists
      const objectHeader = await env.BUCKET.head(key);
      if (!objectHeader) {
        return new Response("Not Found", { status: 404 });
      }

      const totalSize = objectHeader.size;
      const contentType = objectHeader.httpMetadata?.contentType || "application/octet-stream";

      const rangeHeader = request.headers.get("range");
      if (rangeHeader) {
        const range = parseRange(rangeHeader, totalSize);
        if (!range) {
          // Range is not satisfiable
          return new Response("Range Not Satisfiable", {
            status: 416,
            headers: {
              "Accept-Ranges": "bytes",
              "Content-Range": `bytes */${totalSize}`,
            },
          });
        }

        const { start, end } = range;
        const length = end - start + 1;

        // Fetch partial object
        const partialObject = await env.BUCKET.get(key, {
          range: { offset: start, length },
        });

        if (!partialObject || !partialObject.body) {
          return new Response("Error reading object", { status: 500 });
        }

        return new Response(partialObject.body, {
          status: 206,
          headers: {
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes ${start}-${end}/${totalSize}`,
            "Content-Length": length.toString(),
            "Content-Type": contentType,
          },
        });
      }

      // No range header, serve full object
      const fullObject = await env.BUCKET.get(key);
      if (!fullObject || !fullObject.body) {
        return new Response("Error reading object", { status: 500 });
      }

      return new Response(fullObject.body, {
        status: 200,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Length": totalSize.toString(),
          "Content-Type": contentType,
        },
      });
    },
  }),
  render(Document, [route("/", Home)]),
]);
