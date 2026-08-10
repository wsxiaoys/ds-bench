import multer from "multer";
import fs from "fs";
import path from "path";
import { Request, Response } from "express";

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

const upload = multer({ storage }).single("file");

export const uploadFile = (req: any, res: any, context: any) => {
  if (!context.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  upload(req, res, async (err: any) => {
    if (err) {
      return res.status(500).json({ error: "Failed to upload file" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      const folderId = req.body.folderId ? Number(req.body.folderId) : null;
      const userId = context.user.id;

      if (folderId !== null) {
        const folder = await context.entities.Folder.findUnique({
          where: { id: folderId },
        });
        if (!folder || folder.userId !== userId) {
          return res.status(404).json({ error: "Folder not found" });
        }
      }

      const newFile = await context.entities.File.create({
        data: {
          name: req.file.originalname,
          path: req.file.path,
          size: req.file.size,
          mimeType: req.file.mimetype || "application/octet-stream",
          folderId,
          userId,
        },
      });

      return res.json(newFile);
    } catch (dbErr) {
      console.error(dbErr);
      return res.status(500).json({ error: "Database error" });
    }
  });
};

export const downloadFile = async (req: Request, res: Response, context: any) => {
  const { linkId } = req.params;
  const password = req.query.password as string | undefined;

  try {
    const shareLink = await context.entities.ShareLink.findUnique({
      where: { id: linkId },
      include: {
        file: true,
      },
    });

    if (!shareLink) {
      return res.status(404).json({ error: "Sharing link not found" });
    }

    // Check expiration
    if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
      return res.status(410).json({ error: "Sharing link has expired" });
    }

    // Check password
    if (shareLink.password && shareLink.password !== password) {
      return res.status(403).json({ error: "Incorrect password" });
    }

    const file = shareLink.file;
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({ error: "Physical file not found on server" });
    }

    // Log successful download
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    await context.entities.AccessLog.create({
      data: {
        shareLinkId: shareLink.id,
        ipAddress,
        userAgent,
        fileName: file.name,
      },
    });

    // Send file
    return res.download(file.path, file.name);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error during file download" });
  }
};
