import { type RequestHandler } from '@builder.io/qwik-city';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import db from '../../../lib/db';

export const onPost: RequestHandler = async ({ request, redirect }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('image');

    if (file && file instanceof Blob && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const originalName = (file as any).name || 'upload.bin';

      const uniqueId = crypto.randomUUID();
      const ext = path.extname(originalName) || '.png';
      const originalFilename = `${uniqueId}${ext}`;
      const optimizedFilename = `${uniqueId}.webp`;

      const originalDir = '/home/user/qwik-app/public/gallery/original/';
      const optimizedDir = '/home/user/qwik-app/public/gallery/optimized/';

      // Ensure storage directories exist
      fs.mkdirSync(originalDir, { recursive: true });
      fs.mkdirSync(optimizedDir, { recursive: true });

      const originalFilePath = path.join(originalDir, originalFilename);
      const optimizedFilePath = path.join(optimizedDir, optimizedFilename);

      // Save original image
      fs.writeFileSync(originalFilePath, buffer);

      // Get dimensions using sharp
      const sharpInstance = sharp(buffer);
      const metadata = await sharpInstance.metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;

      let resizedInstance = sharp(buffer);
      
      // Optimization Specifications:
      // The optimized image must be resized so that its maximum dimension (width or height) is exactly 800 pixels, preserving the aspect ratio.
      // If the original image is already smaller than 800x800 pixels, do not scale it up; keep its original dimensions but still optimize and convert it to WebP.
      if (width > 800 || height > 800) {
        if (width >= height) {
          resizedInstance = resizedInstance.resize({ width: 800 });
        } else {
          resizedInstance = resizedInstance.resize({ height: 800 });
        }
      }

      // Convert to WebP and get optimized dimensions
      const { data: optimizedBuffer, info } = await resizedInstance
        .webp()
        .toBuffer({ resolveWithObject: true });

      // Save optimized image
      fs.writeFileSync(optimizedFilePath, optimizedBuffer);

      // Public URL paths
      const originalPath = `/gallery/original/${originalFilename}`;
      const optimizedPath = `/gallery/optimized/${optimizedFilename}`;

      // Insert into DB
      const stmt = db.prepare(`
        INSERT INTO images (original_name, original_path, optimized_path, width, height)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(originalName, originalPath, optimizedPath, info.width, info.height);
    }
  } catch (err) {
    console.error('Upload endpoint error:', err);
  }

  // Redirect back to /gallery
  throw redirect(303, '/gallery');
};
