import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * Persist an uploaded `File` to disk and return its publicly-accessible URL.
 *
 * The file is written under `public/uploads/<timestamp>/<filename>` so the
 * browser can fetch it directly via `/uploads/...` once the page is refreshed.
 */
export async function writeFileToDisk(
  file: File,
): Promise<{ url: string; name: string; size: number }> {
  const publicDir = path.resolve(process.cwd(), "public", "uploads");

  // Sub-directory per upload keeps names from clobbering each other.
  const nonce = Date.now().toString();
  const fileDir = path.resolve(publicDir, nonce);

  if (!fs.existsSync(fileDir)) {
    fs.mkdirSync(fileDir, { recursive: true });
  }

  const filePath = path.resolve(fileDir, file.name);
  const fd = fs.createWriteStream(filePath);

  // The web `File` exposes a `stream()` returning a `ReadableStream`. We pipe
  // it through Node's `Readable.fromWeb` to write it to disk chunk-by-chunk,
  // avoiding the cost of loading the entire file into memory.
  const fileStream = Readable.fromWeb(
    file.stream() as unknown as import("node:stream/web").ReadableStream,
  );

  for await (const chunk of fileStream) {
    fd.write(chunk);
  }
  fd.end();

  await new Promise<void>((resolve, reject) => {
    fd.on("finish", () => resolve());
    fd.on("error", (err) => reject(err));
  });

  return {
    url: `/uploads/${nonce}/${file.name}`,
    name: file.name,
    size: file.size,
  };
}