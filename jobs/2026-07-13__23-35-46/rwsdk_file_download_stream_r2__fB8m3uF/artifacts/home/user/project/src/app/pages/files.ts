import { env } from "cloudflare:workers";
import { route } from "rwsdk/router";

// Seed the bucket lazily inside the request lifecycle
async function ensureSeeded() {
  const bucket = env.BUCKET;
  const key = "alphabet.txt";
  const existing = await bucket.head(key);
  if (!existing) {
    await bucket.put(key, "abcdefghijklmnopqrstuvwxyz", {
      httpMetadata: {
        contentType: "text/plain",
      },
    });
  }
}

function parseRangeHeader(
  rangeHeader: string,
  totalSize: number
): { r2Range: R2Range; start: number; end: number; length: number } | null {
  const match = rangeHeader.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  const startStr = match[1];
  const endStr = match[2];

  if (startStr === "" && endStr === "") {
    return null;
  }

  if (startStr === "") {
    // bytes=-suffix (last N bytes)
    const suffix = parseInt(endStr, 10);
    if (isNaN(suffix) || suffix <= 0) return null;
    const actualSuffix = Math.min(suffix, totalSize);
    const start = totalSize - actualSuffix;
    const end = totalSize - 1;
    return {
      r2Range: { suffix: actualSuffix },
      start,
      end,
      length: actualSuffix,
    };
  }

  const start = parseInt(startStr, 10);
  if (isNaN(start) || start < 0 || start >= totalSize) return null;

  if (endStr === "") {
    // bytes=start- (open-ended)
    const end = totalSize - 1;
    const length = totalSize - start;
    return {
      r2Range: { offset: start },
      start,
      end,
      length,
    };
  }

  // bytes=start-end (inclusive)
  const end = parseInt(endStr, 10);
  if (isNaN(end) || end < start) return null;

  const actualEnd = Math.min(end, totalSize - 1);
  const length = actualEnd - start + 1;

  return {
    r2Range: { offset: start, length },
    start,
    end: actualEnd,
    length,
  };
}

export const filesRoute = route("/files/:key", {
  get: async ({ params, request }) => {
    // 1. Ensure R2 bucket is seeded with alphabet.txt if requested key is alphabet.txt (or always seed)
    await ensureSeeded();

    const key = params.key;
    if (!key) {
      return new Response("Not Found", { status: 404 });
    }

    // 2. Check if the object exists
    const bucket = env.BUCKET;
    const meta = await bucket.head(key);
    if (!meta) {
      return new Response("Not Found", { status: 404 });
    }

    const totalSize = meta.size;
    const contentType = meta.httpMetadata?.contentType || "application/octet-stream";

    // 3. Check for Range header
    const rangeHeader = request.headers.get("Range");
    if (rangeHeader) {
      const parsedRange = parseRangeHeader(rangeHeader, totalSize);
      if (parsedRange) {
        // Fetch only the requested bytes from R2
        const partialObject = await bucket.get(key, { range: parsedRange.r2Range });
        if (!partialObject) {
          return new Response("Not Found", { status: 404 });
        }

        const headers = new Headers();
        headers.set("Accept-Ranges", "bytes");
        headers.set("Content-Type", contentType);
        headers.set(
          "Content-Range",
          `bytes ${parsedRange.start}-${parsedRange.end}/${totalSize}`
        );
        headers.set("Content-Length", parsedRange.length.toString());

        return new Response(partialObject.body, {
          status: 206,
          headers,
        });
      }
    }

    // 4. No range or invalid range: return full object
    const fullObject = await bucket.get(key);
    if (!fullObject) {
      return new Response("Not Found", { status: 404 });
    }

    const headers = new Headers();
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Type", contentType);
    headers.set("Content-Length", totalSize.toString());

    return new Response(fullObject.body, {
      status: 200,
      headers,
    });
  },
});
