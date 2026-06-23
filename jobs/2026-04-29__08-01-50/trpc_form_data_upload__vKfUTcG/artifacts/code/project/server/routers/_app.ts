import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { publicProcedure, router } from '../trpc';
import fs from 'fs/promises';
import path from 'path';

export const appRouter = router({
  uploadFile: publicProcedure
    .input(zfd.formData({ file: zfd.file() }))
    .mutation(async ({ input }) => {
      const file = input.file;
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      
      // Ensure directory exists
      await fs.mkdir(uploadDir, { recursive: true });
      
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = path.join(uploadDir, fileName);
      
      await fs.writeFile(filePath, buffer);
      
      return {
        url: `/uploads/${fileName}`,
      };
    }),
});

export type AppRouter = typeof appRouter;
