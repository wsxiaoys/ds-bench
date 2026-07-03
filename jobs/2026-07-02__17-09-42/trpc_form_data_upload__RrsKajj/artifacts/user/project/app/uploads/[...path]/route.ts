import fs from "node:fs";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Dynamic route handler that streams files from `public/uploads/` to the
 * browser. Next.js' built-in static-file serving only knows about files
 * present at build time, so newly-uploaded files need this runtime route.
 *
 * Path-traversal is prevented by resolving the requested path and ensuring
 * it lives under `public/uploads/`.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  if (!segments || segments.length === 0) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
  const requestedPath = path.resolve(uploadsRoot, ...segments);

  // Block path traversal: requestedPath must stay inside uploadsRoot.
  if (
    requestedPath !== uploadsRoot &&
    !requestedPath.startsWith(uploadsRoot + path.sep)
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(requestedPath)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const stat = fs.statSync(requestedPath);
  if (stat.isDirectory()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const data = await fs.promises.readFile(requestedPath);

  // Pick a content-type based on the file extension. We intentionally keep
  // this list small — production apps would use a MIME lookup library.
  const ext = path.extname(requestedPath).toLowerCase();
  const contentType =
    ext === ".png"
      ? "image/png"
      : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".gif"
          ? "image/gif"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".svg"
              ? "image/svg+xml"
              : "application/octet-stream";

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}