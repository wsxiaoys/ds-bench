import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { HttpError } from "wasp/server";
import type { MiddlewareConfigFn } from "wasp/server";
import type { UploadFile, DownloadFile } from "wasp/server/api";

// Project root on the local filesystem. Uploaded files are stored here
// (outside of the generated `.wasp/out` build directory) so they persist
// across dev-server rebuilds/restarts. We can't reliably derive this from
// `__dirname`/`import.meta.url` because Wasp bundles the server code (via
// Rollup) into a single file under `.wasp/out/server/bundle`, so instead we
// resolve it relative to the current working directory the Wasp server is
// started from (the project root), falling back to an explicit override via
// the `PROJECT_ROOT` env var if one is provided.
const PROJECT_ROOT = process.env.PROJECT_ROOT ?? path.resolve(process.cwd(), "..", "..", "..");
const UPLOADS_DIR = path.join(PROJECT_ROOT, "uploads");

function ensureUploadsDirExists() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}
ensureUploadsDirExists();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadsDirExists();
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Attaches the multer middleware (parsing `multipart/form-data`) to every
// API mounted under the `/api/files` path prefix. The uploaded file must be
// sent in a form field named `file`.
export const filesApiMiddlewareFn: MiddlewareConfigFn = (config) => {
  config.set("multer", upload.single("file"));
  return config;
};

// POST /api/files/upload
export const uploadFile: UploadFile = async (req, res, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const file = req.file;
  if (!file) {
    throw new HttpError(
      400,
      'No file was uploaded. Make sure to send it in the "file" form field.',
    );
  }

  const savedFile = await context.entities.File.create({
    data: {
      filename: file.originalname,
      size: file.size,
      path: file.path,
      user: { connect: { id: context.user.id } },
    },
  });

  res.status(201).json({
    id: savedFile.id,
    filename: savedFile.filename,
    size: savedFile.size,
  });
};

// GET /api/files/:id/download
export const downloadFile: DownloadFile = async (req, res, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new HttpError(404);
  }

  const file = await context.entities.File.findUnique({ where: { id } });

  if (!file) {
    throw new HttpError(404);
  }

  if (file.userId !== context.user.id) {
    throw new HttpError(403);
  }

  if (!fs.existsSync(file.path)) {
    throw new HttpError(404);
  }

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(file.filename)}"`,
  );
  res.sendFile(path.resolve(file.path));
};
