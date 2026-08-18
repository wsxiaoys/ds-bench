import fs from 'fs';
import { Request, Response } from 'express';

export const uploadFile = async (req: any, res: any, context: any) => {
  if (!context.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const newFile = await context.entities.File.create({
      data: {
        filename: req.file.originalname,
        size: req.file.size,
        filepath: req.file.path,
        user: { connect: { id: context.user.id } }
      }
    });

    return res.status(201).json({
      id: newFile.id,
      filename: newFile.filename,
      size: newFile.size
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const downloadFile = async (req: any, res: any, context: any) => {
  if (!context.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const fileId = parseInt(req.params.id, 10);
  if (isNaN(fileId)) {
    return res.status(400).json({ error: 'Invalid file ID' });
  }

  try {
    const file = await context.entities.File.findUnique({
      where: { id: fileId }
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.userId !== context.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fs.existsSync(file.filepath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
    return res.sendFile(file.filepath);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
