import fs from "fs";
import path from "path";
import multer from "multer";
import type { MiddlewareConfigFn } from "wasp/server";
import type { UploadFile, DownloadFile } from "wasp/server/api";

const uploadDir = "/home/user/app/uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
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
  if (!context.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const folderIdStr = req.body.folderId;
  const folderId =
    folderIdStr && folderIdStr !== "null" && folderIdStr !== "undefined"
      ? parseInt(folderIdStr, 10)
      : null;

  try {
    const newFile = await context.entities.File.create({
      data: {
        name: file.originalname,
        path: file.path,
        mimeType: file.mimetype,
        size: file.size,
        folderId,
        userId: context.user.id,
      },
    });

    return res.json({ success: true, file: newFile });
  } catch (error: any) {
    console.error("Error creating file metadata:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const downloadFile: DownloadFile = async (req, res, context) => {
  const { linkId } = req.params;

  try {
    const shareLink = await context.entities.ShareLink.findUnique({
      where: { id: linkId },
      include: {
        file: true,
      },
    }) as any;

    if (!shareLink) {
      return res.status(404).json({ error: "Share link not found" });
    }

    // Check expiration
    if (shareLink.expiresAt && new Date() > new Date(shareLink.expiresAt)) {
      return res.status(410).json({ error: "Link has expired" });
    }

    // Check password
    if (shareLink.password) {
      const providedPassword = req.query.password;
      if (!providedPassword || providedPassword !== shareLink.password) {
        return res.status(403).json({ error: "Invalid password" });
      }
    }

    const filePath = shareLink.file.path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File content not found on server" });
    }

    // Record Access Log
    const xForwardedFor = req.headers["x-forwarded-for"];
    const ipAddress = (Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor) || req.socket.remoteAddress || "unknown";
    const userAgent = (req.headers["user-agent"] || "unknown") as string;

    await context.entities.AccessLog.create({
      data: {
        shareLinkId: shareLink.id,
        ipAddress,
        userAgent,
        fileName: shareLink.file.name,
      },
    });

    // Serve file
    res.setHeader("Content-Type", shareLink.file.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(shareLink.file.name)}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error: any) {
    console.error("Error downloading file:", error);
    return res.status(500).json({ error: error.message });
  }
};
