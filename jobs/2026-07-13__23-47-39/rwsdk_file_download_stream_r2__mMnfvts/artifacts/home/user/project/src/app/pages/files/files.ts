import { route } from "rwsdk/router";
import { env } from "cloudflare:workers";

/**
 * The fixture that must be present in the bound R2 bucket so the
 * download endpoint can serve it. It is seeded lazily inside the
 * request lifecycle (workers cannot perform I/O at module top level).
 */
const FIXTURE_KEY = "alphabet.txt";
const FIXTURE_BODY = "abcdefghijklmnopqrstuvwxyz";
const FIXTURE_CONTENT_TYPE = "text/plain";

/**
 * Ensures the sample object exists in the R2 bucket. Uses `head` to
 * check for existence and `put` to create it when missing.
 */
async function ensureSeedObject(): Promise<void> {
  const bucket = env.FILES_BUCKET;
  const existing = await bucket.head(FIXTURE_KEY);
  if (existing === null) {
    await bucket.put(FIXTURE_KEY, FIXTURE_BODY, {
      httpMetadata: { contentType: FIXTURE_CONTENT_TYPE },
    });
  }
}

/**
 * Parses an HTTP `Range` header value for a single byte range.
 *
 * Supports the three standard forms:
 *   - `bytes=start-end`  (explicit start and end, inclusive)
 *   - `bytes=start-`     (open-ended, from start to the end of the object)
 *   - `bytes=-suffix`    (last N bytes of the object)
 *
 * Returns `null` when the header is absent or malformed.
 */
function parseRange(
  rangeHeader: string | null,
  totalSize: number,
): { offset: number; length: number } | { suffix: number } | null {
  if (rangeHeader === null) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (match === null) {
    return null;
  }

  const startStr = match[1];
  const endStr = match[2];

  // `bytes=-suffix` → last N bytes.
  if (startStr === "") {
    const suffix = Number(endStr);
    if (!Number.isFinite(suffix) || suffix <= 0) {
      return null;
    }
    return { suffix };
  }

  const start = Number(startStr);
  if (!Number.isFinite(start) || start < 0 || start >= totalSize) {
    return null;
  }

  // `bytes=start-` → from start to the end of the object.
  if (endStr === "") {
    return { offset: start, length: totalSize - start };
  }

  // `bytes=start-end` → explicit inclusive range.
  const end = Number(endStr);
  if (!Number.isFinite(end) || end < start) {
    return null;
  }

  // Clamp end to the last available byte.
  const clampedEnd = Math.min(end, totalSize - 1);
  return { offset: start, length: clampedEnd - start + 1 };
}

export const filesRoutes = [
  route("/files/:key", async function fileDownload({ request, params }) {
    const key = params.key as string;

    // Lazily seed the fixture object so it is available for download.
    await ensureSeedObject();

    const bucket = env.FILES_BUCKET;
    const rangeHeader = request.headers.get("range");

    // We need the object size to parse/validate the range. A `head` call
    // is cheap and lets us respond with 404 before attempting a `get`.
    const headObject = await bucket.head(key);
    if (headObject === null) {
      return new Response("Not Found", { status: 404 });
    }

    const totalSize = headObject.size;
    const contentType =
      headObject.httpMetadata?.contentType ?? "application/octet-stream";

    // No Range header → serve the full object.
    if (rangeHeader === null) {
      const object = await bucket.get(key);
      if (object === null) {
        return new Response("Not Found", { status: 404 });
      }

      const headers = new Headers();
      headers.set("Content-Type", contentType);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Length", String(totalSize));

      return new Response(object.body, { status: 200, headers });
    }

    const range = parseRange(rangeHeader, totalSize);
    if (range === null) {
      // Malformed/unsatisfiable range → 416 with the full size.
      const headers = new Headers();
      headers.set("Content-Range", `bytes */${totalSize}`);
      return new Response("Range Not Satisfiable", { status: 416, headers });
    }

    const object = await bucket.get(key, { range });
    if (object === null) {
      return new Response("Not Found", { status: 404 });
    }

    // The R2 `get` response exposes the resolved range so we can build
    // an accurate `Content-Range` header regardless of which form was
    // requested (offset/length or suffix). R2 normalises the resolved
    // range to an explicit offset/length pair.
    const resolvedRange = object.range;
    let start: number;
    let partialSize: number;
    if (resolvedRange === undefined) {
      // Fallback: should not happen when a range was requested, but keep
      // the response consistent with the requested range.
      if ("suffix" in range) {
        start = Math.max(0, totalSize - range.suffix);
        partialSize = totalSize - start;
      } else {
        start = range.offset;
        partialSize = range.length;
      }
    } else if ("suffix" in resolvedRange) {
      start = Math.max(0, totalSize - resolvedRange.suffix);
      partialSize = totalSize - start;
    } else {
      start = resolvedRange.offset ?? 0;
      partialSize = resolvedRange.length ?? totalSize - start;
    }
    const end = start + partialSize - 1;

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Range", `bytes ${start}-${end}/${totalSize}`);
    headers.set("Content-Length", String(partialSize));

    return new Response(object.body, { status: 206, headers });
  }),
];