import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  uploadFile: publicProcedure
    .input(zfd.formData({ file: zfd.file() }))
    .mutation(async ({ input }) => {
      const file = input.file;
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadsDir, { recursive: true });
      const filename = `${Date.now()}-${file.name}`;
      const filepath = path.join(uploadsDir, filename);
      await writeFile(filepath, buffer);
      const url = `/uploads/${filename}`;
      return { url, filename, size: file.size, type: file.type };
    }),
});

export type AppRouter = typeof appRouter;
