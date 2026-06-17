import { zfd } from 'zod-form-data';
import { z } from 'zod';
import { router, publicProcedure } from './trpc';
import { writeFile } from 'fs/promises';
import path from 'path';

export const appRouter = router({
  uploadFile: publicProcedure
    .input(zfd.formData({
      file: zfd.file(),
    }))
    .mutation(async ({ input }) => {
      const file = input.file;

      // Generate a unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.name}`;
      const uploadPath = path.join(process.cwd(), 'public', 'uploads', filename);

      // Convert File to Buffer and write to disk
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await writeFile(uploadPath, buffer);

      // Return the URL to access the uploaded file
      return {
        url: `/uploads/${filename}`,
        filename: file.name,
        size: file.size,
        type: file.type,
      };
    }),
});

export type AppRouter = typeof appRouter;