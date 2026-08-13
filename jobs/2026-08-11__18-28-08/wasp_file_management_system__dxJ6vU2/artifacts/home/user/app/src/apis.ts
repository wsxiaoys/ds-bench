import multer from 'multer';
import fs from 'fs';
import path from 'path';

const uploadDir = '/home/user/app/uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({ storage }).single('file');

export const uploadFile = (req: any, res: any, context: any) => {
  upload(req, res, async (err: any) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const folderId = req.body.folderId ? Number(req.body.folderId) : null;
      
      if (folderId) {
        const folder = await context.entities.Folder.findFirst({
          where: {
            id: folderId,
            userId: context.user.id,
          },
        });
        if (!folder) {
          return res.status(404).json({ error: 'Folder not found' });
        }
      }

      const fileRecord = await context.entities.File.create({
        data: {
          name: req.file.originalname,
          originalName: req.file.originalname,
          path: req.file.path,
          mimeType: req.file.mimetype,
          size: req.file.size,
          folderId: folderId,
          userId: context.user.id,
        },
      });

      return res.status(200).json(fileRecord);
    } catch (dbErr: any) {
      return res.status(500).json({ error: dbErr.message });
    }
  });
};

export const downloadFile = async (req: any, res: any, context: any) => {
  try {
    const { linkId } = req.params;
    const password = req.query.password;
    const isCheck = req.query.check === 'true';

    if (!linkId) {
      return res.status(400).json({ error: 'Link ID is required' });
    }

    const shareLink = await context.entities.ShareLink.findUnique({
      where: { id: linkId },
      include: {
        file: true,
      },
    });

    if (!shareLink) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    // Check expiration
    if (shareLink.expiresAt && new Date() > new Date(shareLink.expiresAt)) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    // Check password
    if (shareLink.password && shareLink.password !== password) {
      return res.status(403).json({ error: 'Incorrect password' });
    }

    if (isCheck) {
      return res.status(200).json({ success: true });
    }

    const filePath = shareLink.file.path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Log the access
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await context.entities.AccessLog.create({
      data: {
        fileId: shareLink.file.id,
        ip: Array.isArray(ip) ? ip[0] : ip,
        userAgent,
      },
    });

    // Serve file content
    res.setHeader('Content-Type', shareLink.file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(shareLink.file.name)}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
