import { zfd } from 'zod-form-data';
import { router, publicProcedure } from './trpc';
import fs from 'node:fs/promises';
import path from 'node:path';

export const appRouter = router({
  uploadFile: publicProcedure
    .input(
      zfd.formData({
        file: zfd.file(),
      })
    )
    .mutation(async ({ input }) => {
      const { file } = input;
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      
      // Ensure directory exists
      await fs.mkdir(uploadDir, { recursive: true });
      
      const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      const filePath = path.join(uploadDir, fileName);
      
      await fs.writeFile(filePath, buffer);
      
      return {
        url: `/uploads/${fileName}`,
      };
    }),
});

export type AppRouter = typeof appRouter;
