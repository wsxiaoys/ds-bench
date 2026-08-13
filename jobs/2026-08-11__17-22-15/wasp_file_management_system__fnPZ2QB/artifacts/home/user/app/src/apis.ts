import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { MiddlewareConfigFn } from 'wasp/server';

// Ensure uploads directory exists
const UPLOADS_DIR = '/home/user/app/uploads/';
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Avoid filename conflicts by prefixing with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({ storage: storage });

export const configureFileUploadMiddleware: MiddlewareConfigFn = (config) => {
  config.set('multer', upload.single('file'));
  return config;
};

export const uploadFile = async (req: any, res: any, context: any) => {
  if (!context.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const folderId = req.body.folderId ? parseInt(req.body.folderId, 10) : null;
  const userId = context.user.id;

  // Create File metadata in database
  const fileRecord = await context.entities.File.create({
    data: {
      name: req.file.originalname,
      path: req.file.path, // Full path on disk
      mimeType: req.file.mimetype || 'application/octet-stream',
      size: req.file.size,
      folderId,
      userId,
    },
  });

  return res.json(fileRecord);
};

export const downloadFile = async (req: any, res: any, context: any) => {
  const { linkId } = req.params;
  const password = req.query.password || null;

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

  // Support verifyOnly=true
  if (req.query.verifyOnly === 'true') {
    return res.json({ success: true });
  }

  const file = shareLink.file;
  if (!fs.existsSync(file.path)) {
    return res.status(404).json({ error: 'File not found on server disk' });
  }

  // Create AccessLog entry
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  await context.entities.AccessLog.create({
    data: {
      fileId: file.id,
      ip: String(ip),
      userAgent: String(userAgent),
    },
  });

  // Serve file
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', file.size);

  const fileStream = fs.createReadStream(file.path);
  fileStream.pipe(res);
};
