import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import type { MiddlewareConfigFn } from "wasp/server";
import type { DownloadFile, UploadFile } from "wasp/server/api";
import { verifyPassword } from "./server/crypto";

export const UPLOADS_DIR = "/home/user/app/uploads/";

// Make sure the uploads directory exists before Multer tries to write to it.
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR });

export const configureUploadMiddleware: MiddlewareConfigFn = (config) => {
  config.set("multer", upload.single("file"));
  return config;
};

// Returning the (already CORS-enabled) default middleware config makes sure
// this API namespace can be called from the client with `wasp/client/api`.
export const enableApiCors: MiddlewareConfigFn = (config) => {
  return config;
};

export const uploadFile: UploadFile = async (req, res, context) => {
  if (!context.user) {
    res.status(401).json({ error: "You must be logged in" });
    return;
  }

  const uploadedFile = req.file;
  if (!uploadedFile) {
    res.status(400).json({ error: "No file provided" });
    return;
  }

  const folderIdRaw = req.body?.folderId;
  let folderId: number | null = null;
  if (
    folderIdRaw !== undefined &&
    folderIdRaw !== null &&
    folderIdRaw !== "" &&
    folderIdRaw !== "null" &&
    folderIdRaw !== "undefined"
  ) {
    folderId = parseInt(String(folderIdRaw), 10);
  }

  if (folderId !== null) {
    const folder = await context.entities.Folder.findUnique({
      where: { id: folderId },
    });
    if (!folder || folder.userId !== context.user.id) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }
  }

  const originalName =
    (req.body?.name as string | undefined) || uploadedFile.originalname;

  const file = await context.entities.File.create({
    data: {
      name: originalName,
      storedName: uploadedFile.filename,
      size: uploadedFile.size,
      mimeType: uploadedFile.mimetype || "application/octet-stream",
      folderId,
      userId: context.user.id,
    },
  });

  res.json({ file });
};

export const downloadFile: DownloadFile<{ linkId: string }> = async (
  req,
  res,
  context,
) => {
  const { linkId } = req.params;
  const passwordParam =
    typeof req.query.password === "string" ? req.query.password : undefined;

  const shareLink = await context.entities.ShareLink.findUnique({
    where: { id: linkId },
  });

  if (!shareLink) {
    res.status(404).json({ error: "This share link does not exist" });
    return;
  }

  if (shareLink.expiresAt && shareLink.expiresAt.getTime() < Date.now()) {
    res.status(410).json({ error: "This share link has expired" });
    return;
  }

  if (shareLink.passwordHash) {
    if (
      !passwordParam ||
      !verifyPassword(passwordParam, shareLink.passwordHash)
    ) {
      res.status(401).json({ error: "Incorrect or missing password" });
      return;
    }
  }

  const file = await context.entities.File.findUnique({
    where: { id: shareLink.fileId },
  });

  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const filePath = path.join(UPLOADS_DIR, file.storedName);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File is missing from storage" });
    return;
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  const ipAddress =
    (typeof forwardedFor === "string"
      ? forwardedFor.split(",")[0]?.trim()
      : undefined) ||
    req.socket.remoteAddress ||
    "unknown";
  const userAgent = req.get("user-agent") || "unknown";

  await context.entities.AccessLog.create({
    data: {
      shareLinkId: shareLink.id,
      fileId: file.id,
      fileName: file.name,
      ownerId: shareLink.userId,
      ipAddress,
      userAgent,
    },
  });

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(file.name)}"`,
  );
  res.setHeader("Content-Type", file.mimeType);
  fs.createReadStream(filePath).pipe(res);
};
