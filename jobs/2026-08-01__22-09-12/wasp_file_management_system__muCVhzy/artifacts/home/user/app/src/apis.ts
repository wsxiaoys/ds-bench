import type { MiddlewareConfigFn } from "wasp/server";
import type { UploadFile, DownloadFile } from "wasp/server/api";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "wasp/server";

const uploadDir = path.join("/home/user/app/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

export const configureFileUploadMiddleware: MiddlewareConfigFn = (config) => {
  config.set("multer", upload.single("file"));
  return config;
};

export const uploadFile: UploadFile = async (req, res, context) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  if (!context.user) {
    fs.unlinkSync(file.path);
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const folderId = req.body.folderId ? parseInt(req.body.folderId as string, 10) : null;

  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: context.user.id },
    });
    if (!folder) {
      fs.unlinkSync(file.path);
      res.status(404).json({ error: "Folder not found" });
      return;
    }
  }

  const dbFile = await prisma.file.create({
    data: {
      name: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      serverPath: file.path,
      folderId,
      userId: context.user.id,
    },
  });

  res.json(dbFile);
};

export const downloadFile: DownloadFile<
  { linkId: string },
  any,
  any,
  { password?: string }
> = async (req, res) => {
  const { linkId } = req.params;
  const password = req.query.password as string | undefined;

  const shareLink = await prisma.shareLink.findUnique({
    where: { id: linkId },
    include: { file: true, createdBy: true },
  });

  if (!shareLink) {
    res.status(404).json({ error: "Share link not found" });
    return;
  }

  // Check expiration
  if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
    res.status(410).json({ error: "This share link has expired." });
    return;
  }

  // Check password
  if (shareLink.password) {
    if (!password || password !== shareLink.password) {
      res.status(403).json({ error: "Invalid or missing password." });
      return;
    }
  }

  // Check if file exists on disk
  if (!fs.existsSync(shareLink.file.serverPath)) {
    res.status(404).json({ error: "File not found on server" });
    return;
  }

  // Create access log
  const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
  const userAgent = (req.headers["user-agent"] as string) || "unknown";

  await prisma.accessLog.create({
    data: {
      fileId: shareLink.fileId,
      userId: shareLink.createdById,
      ipAddress,
      userAgent,
    },
  });

  // Serve the file
  const filePath = shareLink.file.serverPath;
  const fileName = shareLink.file.name;
  res.setHeader("Content-Type", shareLink.file.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.setHeader("Content-Length", shareLink.file.size);

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
};
