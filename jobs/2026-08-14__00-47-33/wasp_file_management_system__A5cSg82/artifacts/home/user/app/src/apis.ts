import multer from "multer";
import fs from "fs";
import path from "path";

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

export const uploadMiddleware = (config: any) => {
  config.set("multer", upload.single("file"));
  return config;
};

export const uploadFile = async (req: any, res: any, context: any) => {
  if (!context.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const folderId = req.body.folderId ? parseInt(req.body.folderId, 10) : null;

    // Verify folder belongs to user if folderId is provided
    if (folderId) {
      const folder = await context.entities.Folder.findUnique({
        where: { id: folderId },
      });
      if (!folder || folder.userId !== context.user.id) {
        return res.status(400).json({ error: "Invalid folder" });
      }
    }

    const newFile = await context.entities.File.create({
      data: {
        name: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        localPath: req.file.path,
        folderId,
        userId: context.user.id,
      },
    });

    return res.json(newFile);
  } catch (error: any) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: error.message || "Failed to save file metadata" });
  }
};

export const downloadFile = async (req: any, res: any, context: any) => {
  const { linkId } = req.params;
  const passwordQuery = req.query.password;

  try {
    const shareLink = await context.entities.ShareLink.findUnique({
      where: { id: linkId },
      include: {
        file: true,
      },
    });

    if (!shareLink) {
      return res.status(404).json({ error: "Share link not found" });
    }

    // Check expiration
    const isExpired = shareLink.expiresAt ? new Date() > new Date(shareLink.expiresAt) : false;
    if (isExpired) {
      return res.status(410).json({ error: "Share link has expired" });
    }

    // Check password
    if (shareLink.password && passwordQuery !== shareLink.password) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // Check if the actual file exists on disk
    if (!fs.existsSync(shareLink.file.localPath)) {
      return res.status(404).json({ error: "File not found on server disk" });
    }

    // Log the access
    const ipAddress =
      (req.headers["x-forwarded-for"] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    await context.entities.AccessLog.create({
      data: {
        fileId: shareLink.fileId,
        ipAddress,
        userAgent,
      },
    });

    // Send file
    res.setHeader("Content-Type", shareLink.file.mimeType);
    res.setHeader("Content-Length", shareLink.file.size);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(shareLink.file.name)}"`
    );

    return res.sendFile(shareLink.file.localPath);
  } catch (error: any) {
    console.error("Download error:", error);
    return res.status(500).json({ error: error.message || "Failed to download file" });
  }
};
