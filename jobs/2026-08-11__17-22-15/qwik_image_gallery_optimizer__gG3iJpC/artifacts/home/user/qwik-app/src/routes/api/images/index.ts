import { type RequestHandler } from '@builder.io/qwik-city';
import db, { type ImageRecord } from '../../../lib/db';

export const onGet: RequestHandler = async ({ json }) => {
  try {
    const stmt = db.prepare(`
      SELECT id, original_name, original_path, optimized_path, width, height, uploaded_at
      FROM images
      ORDER BY uploaded_at DESC
    `);
    const images = stmt.all() as ImageRecord[];
    
    // Map to the requested JSON format:
    // [
    //   {
    //     "id": 1,
    //     "original_name": "myphoto.png",
    //     "original_path": "/gallery/original/filename.png",
    //     "optimized_path": "/gallery/optimized/filename.webp",
    //     "width": 800,
    //     "height": 600
    //   }
    // ]
    const responseData = images.map((img) => ({
      id: img.id,
      original_name: img.original_name,
      original_path: img.original_path,
      optimized_path: img.optimized_path,
      width: img.width,
      height: img.height,
    }));

    json(200, responseData);
  } catch (err) {
    console.error('API Error:', err);
    json(500, { error: 'Internal Server Error' });
  }
};
