import { env } from "cloudflare:workers";

/**
 * Fixture object that must be present in the R2 bucket for downloads.
 * The body is exactly the 26 lowercase ASCII letters.
 */
const FIXTURE_KEY = "alphabet.txt";
const FIXTURE_BODY = "abcdefghijklmnopqrstuvwxyz";
const FIXTURE_CONTENT_TYPE = "text/plain";

/**
 * Lazily seed the fixture object the first time it is requested.
 * Workers cannot perform I/O at module top level, so this must happen
 * inside the request lifecycle.
 */
async function ensureFixture(): Promise<void> {
  const bucket = env.BUCKET;
  const existing = await bucket.head(FIXTURE_KEY);
  if (existing) return;
  await bucket.put(FIXTURE_KEY, FIXTURE_BODY, {
    httpMetadata: { contentType: FIXTURE_CONTENT_TYPE },
  });
}

/**
 * Resolve the offset/length pair that should be requested from R2 for
 * a given standard HTTP `Range` header and object size.
 *
 * Supported forms:
 *   `bytes=start-end` (inclusive on both ends)
 *   `bytes=start-`    (open-ended, from `start` through end of object)
 *   `bytes=-suffix`   (last `suffix` bytes of the object)
 *
 * Returns `null` when the header cannot be parsed or the range is
 * syntactically invalid (e.g. `start > end`). Returns a marker object
 * when the range is well-formed but unsatisfiable for the current size.
 */
type ParsedRange =
  | { kind: "ok"; offset: number; length: number }
  | { kind: "unsatisfiable" };

function parseRangeHeader(header: string, size: number): ParsedRange | null {
  if (typeof header !== "string") return null;
  if (!header.startsWith("bytes=")) return null;

  const spec = header.slice("bytes=".length).trim();
  const dashIdx = spec.indexOf("-");
  if (dashIdx === -1) return null;

  const startStr = spec.slice(0, dashIdx).trim();
  const endStr = spec.slice(dashIdx + 1).trim();

  // Suffix form: bytes=-N (last N bytes).
  if (startStr === "") {
    if (endStr === "") return null;
    const suffix = Number(endStr);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    if (suffix > size) {
      // Spec: clamp the suffix to the entire object.
      return { kind: "ok", offset: 0, length: size };
    }
    return { kind: "ok", offset: size - suffix, length: suffix };
  }

  const start = Number(startStr);
  if (!Number.isFinite(start) || start < 0) return null;

  // Open-ended form: bytes=N-
  if (endStr === "") {
    if (start >= size) return { kind: "unsatisfiable" };
    return { kind: "ok", offset: start, length: size - start };
  }

  // Closed form: bytes=N-M
  const end = Number(endStr);
  if (!Number.isFinite(end) || end < start) return null;
  if (start >= size) return { kind: "unsatisfiable" };
  const clampedEnd = Math.min(end, size - 1);
  return { kind: "ok", offset: start, length: clampedEnd - start + 1 };
}

/**
 * Resolve the start (inclusive, 0-based) and end (inclusive) byte
 * indices from the range that R2 actually returned. Falls back to
 * the originally requested range if the response does not advertise
 * one.
 */
function resolveRangeBounds(
  requested: { offset: number; length: number },
  returned: R2Range | undefined,
): { start: number; end: number; length: number } {
  if (returned) {
    if ("suffix" in returned) {
      // The response was generated from a suffix range; we know the
      // length but not the absolute offset here, so derive it from the
      // full size reported by R2 via the caller.
      const length = returned.suffix;
      return { start: -1, end: -1, length };
    }
    const offset = returned.offset ?? 0;
    const length = returned.length ?? requested.length;
    return { start: offset, end: offset + length - 1, length };
  }
  return {
    start: requested.offset,
    end: requested.offset + requested.length - 1,
    length: requested.length,
  };
}

/**
 * GET /files/:key — stream an R2 object as the response body, honoring
 * the HTTP `Range` request header.
 */
export async function handleFileDownload(
  request: Request,
  params: { key: string },
): Promise<Response> {
  await ensureFixture();

  const key = params.key;
  const bucket = env.BUCKET;

  const objectInfo = await bucket.head(key);
  if (!objectInfo) {
    return new Response("Not Found", { status: 404 });
  }

  const totalSize = objectInfo.size;
  const contentType =
    objectInfo.httpMetadata?.contentType ?? "application/octet-stream";

  const rangeHeader = request.headers.get("Range");
  const parsedRange = rangeHeader ? parseRangeHeader(rangeHeader, totalSize) : null;

  // If a Range header was sent but couldn't be understood, ignore it and
  // serve the full object (per HTTP semantics for malformed ranges).
  const shouldServeRange = parsedRange && parsedRange.kind === "ok";
  const isUnsatisfiable = parsedRange && parsedRange.kind === "unsatisfiable";

  if (isUnsatisfiable) {
    return new Response("Range Not Satisfiable", {
      status: 416,
      headers: {
        "Content-Range": `bytes */${totalSize}`,
        "Accept-Ranges": "bytes",
      },
    });
  }

  if (shouldServeRange) {
    const requested = parsedRange as Extract<ParsedRange, { kind: "ok" }>;
    const object = await bucket.get(key, { range: requested });
    if (!object || !object.body) {
      return new Response("Not Found", { status: 404 });
    }
    const bounds = resolveRangeBounds(requested, object.range);
    const start = bounds.start;
    const end = bounds.end;
    const length = bounds.length;

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Length", String(length));
    headers.set("Accept-Ranges", "bytes");
    headers.set(
      "Content-Range",
      `bytes ${start}-${end}/${object.size ?? totalSize}`,
    );

    return new Response(object.body, { status: 206, headers });
  }

  const object = await bucket.get(key);
  if (!object || !object.body) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Length", String(totalSize));
  headers.set("Accept-Ranges", "bytes");

  return new Response(object.body, { status: 200, headers });
}