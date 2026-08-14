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
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({ storage });
const singleUpload = upload.single("file");

export const uploadFile = (req: any, res: any, context: any) => {
  if (!context.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = context.user.id;

  singleUpload(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { folderId } = req.body;

    try {
      if (folderId && folderId !== "null" && folderId !== "undefined") {
        const folder = await context.entities.Folder.findFirst({
          where: { id: folderId, userId },
        });
        if (!folder) {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: "Folder not found" });
        }
      }

      const fileRecord = await context.entities.File.create({
        data: {
          name: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          localPath: req.file.path,
          folderId: (folderId && folderId !== "null" && folderId !== "undefined") ? folderId : null,
          userId,
        },
      });

      return res.status(200).json(fileRecord);
    } catch (dbErr: any) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ error: dbErr.message });
    }
  });
};

export const downloadFile = async (req: any, res: any, context: any) => {
  const { linkId } = req.params;
  const { password } = req.query;

  try {
    const shareLink = await context.entities.ShareLink.findUnique({
      where: { id: linkId },
      include: { file: true },
    });

    if (!shareLink) {
      return res.status(404).json({ error: "Share link not found" });
    }

    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return res.status(410).json({ error: "Share link has expired" });
    }

    if (shareLink.password && shareLink.password !== password) {
      return res.status(403).json({ error: "Incorrect password" });
    }

    const file = shareLink.file;
    if (!fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: "File not found on server" });
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string || req.ip || req.socket.remoteAddress || "Unknown").split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || "Unknown";

    await context.entities.AccessLog.create({
      data: {
        fileId: file.id,
        ipAddress,
        userAgent,
      },
    });

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader("Content-Length", file.size);

    const fileStream = fs.createReadStream(file.localPath);
    fileStream.pipe(res);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
