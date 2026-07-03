import { router, publicProcedure } from './trpc';
import { zfd } from 'zod-form-data';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const appRouter = router({
  uploadFile: publicProcedure
    .input(
      zfd.formData({
        file: zfd.file(),
      })
    )
    .mutation(async ({ input }) => {
      const file = input.file;
      if (!file) {
        throw new Error('No file uploaded');
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadDir, { recursive: true });

      // Generate a safe unique filename
      const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = path.join(uploadDir, uniqueFilename);
      await writeFile(filePath, buffer);

      return {
        url: `/uploads/${uniqueFilename}`,
        name: file.name,
        size: file.size,
        type: file.type,
      };
    }),
});

export type AppRouter = typeof appRouter;
