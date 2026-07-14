import { env } from "cloudflare:workers";

// ---------------------------------------------------------------------------
// Fixture: seed the bucket with alphabet.txt on first request
// ---------------------------------------------------------------------------
const FIXTURE_KEY = "alphabet.txt";
const FIXTURE_BODY = "abcdefghijklmnopqrstuvwxyz";
const FIXTURE_CONTENT_TYPE = "text/plain";

async function ensureFixture(): Promise<void> {
  const existing = await env.FILES_BUCKET.head(FIXTURE_KEY);
  if (!existing) {
    await env.FILES_BUCKET.put(FIXTURE_KEY, FIXTURE_BODY, {
      httpMetadata: { contentType: FIXTURE_CONTENT_TYPE },
    });
  }
}

// ---------------------------------------------------------------------------
// Range header parser
// Returns { offset, length } for R2 get(), or null if no/invalid range.
// Also returns the resolved start/end (0-based, inclusive) and suffix flag.
// ---------------------------------------------------------------------------
interface ParsedRange {
  // These map directly to R2 GetOptions range
  r2Range: R2Range;
  // The resolved inclusive start/end byte positions (needed for Content-Range)
  start: number;
  end: number;
}

function parseRangeHeader(
  rangeHeader: string,
  totalSize: number
): ParsedRange | null {
  // Must start with "bytes="
  if (!rangeHeader.startsWith("bytes=")) return null;

  const spec = rangeHeader.slice("bytes=".length).trim();

  // bytes=-N  (last N bytes / suffix range)
  const suffixMatch = spec.match(/^-(\d+)$/);
  if (suffixMatch) {
    const suffix = parseInt(suffixMatch[1], 10);
    if (suffix <= 0) return null;
    const clampedSuffix = Math.min(suffix, totalSize);
    const start = totalSize - clampedSuffix;
    const end = totalSize - 1;
    return {
      r2Range: { suffix: clampedSuffix },
      start,
      end,
    };
  }

  // bytes=start-  or  bytes=start-end
  const rangeMatch = spec.match(/^(\d+)-(\d*)$/);
  if (!rangeMatch) return null;

  const start = parseInt(rangeMatch[1], 10);
  const endStr = rangeMatch[2];

  if (start >= totalSize) return null; // unsatisfiable

  let end: number;
  let length: number;

  if (endStr === "") {
    // Open-ended: bytes=start-
    end = totalSize - 1;
    length = totalSize - start;
  } else {
    end = parseInt(endStr, 10);
    if (end < start) return null; // malformed
    end = Math.min(end, totalSize - 1); // clamp to object size
    length = end - start + 1;
  }

  return {
    r2Range: { offset: start, length },
    start,
    end,
  };
}

// ---------------------------------------------------------------------------
// Route handler: GET /files/:key
// ---------------------------------------------------------------------------
export async function handleFileDownload(
  request: Request,
  { params }: { params: { key: string } }
): Promise<Response> {
  // Seed fixture lazily so it is available on every cold start
  await ensureFixture();

  const { key } = params;

  // Probe total size first so we can parse the Range header correctly
  const head = await env.FILES_BUCKET.head(key);
  if (!head) {
    return new Response("Not Found", { status: 404 });
  }

  const totalSize = head.size;
  const contentType =
    head.httpMetadata?.contentType ?? "application/octet-stream";

  const rangeHeader = request.headers.get("Range");

  // -------------------------------------------------------------------------
  // No Range → 200 full response
  // -------------------------------------------------------------------------
  if (!rangeHeader) {
    const object = await env.FILES_BUCKET.get(key);
    if (!object) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(object.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(totalSize),
        "Accept-Ranges": "bytes",
      },
    });
  }

  // -------------------------------------------------------------------------
  // Range header present → 206 partial response
  // -------------------------------------------------------------------------
  const parsed = parseRangeHeader(rangeHeader, totalSize);

  if (!parsed) {
    // Unsatisfiable range
    return new Response("Range Not Satisfiable", {
      status: 416,
      headers: {
        "Content-Range": `bytes */${totalSize}`,
      },
    });
  }

  const { r2Range, start, end } = parsed;
  const partialLength = end - start + 1;

  const object = await env.FILES_BUCKET.get(key, { range: r2Range });
  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(object.body, {
    status: 206,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(partialLength),
      "Content-Range": `bytes ${start}-${end}/${totalSize}`,
      "Accept-Ranges": "bytes",
    },
  });
}
