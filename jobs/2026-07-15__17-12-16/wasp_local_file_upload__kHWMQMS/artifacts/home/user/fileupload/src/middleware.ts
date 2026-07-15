import multer from 'multer';
import path from 'path';
import { type MiddlewareConfigFn } from 'wasp/server';

const upload = multer({ dest: path.join(process.cwd(), 'uploads') });

export const filesMiddlewareConfig: MiddlewareConfigFn = (config) => {
  config.set('multer', upload.single('file'));
  return config;
};
