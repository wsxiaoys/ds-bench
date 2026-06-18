const { createServer } = require("http");
const next = require("next");
const { createReadStream, existsSync } = require("fs");
const { join, extname } = require("path");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv",
  ".bin": "application/octet-stream",
};

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const pathname = req.url ? req.url.split("?")[0] : "/";

      // Serve uploaded files directly from public/uploads
      if (pathname.startsWith("/uploads/")) {
        const filename = pathname.slice("/uploads/".length);

        // Prevent directory traversal
        if (!filename || filename.includes("..") || filename.includes("/")) {
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden");
          return;
        }

        const filePath = join(process.cwd(), "public", "uploads", filename);

        if (existsSync(filePath)) {
          const ext = extname(filename).toLowerCase();
          const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
          res.writeHead(200, {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
          });
          createReadStream(filePath).pipe(res);
          return;
        }
      }

      // Fall through to Next.js for everything else
      await handle(req, res);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
