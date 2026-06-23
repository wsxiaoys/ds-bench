import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { publicProcedure, router } from '../trpc';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function safeFilename(name: string) {
  // Strip directory parts, normalize and prefix with a timestamp to avoid
  // collisions while preserving the file extension.
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${Date.now()}-${base}`;
}

export const appRouter = router({
  /**
   * Upload a file to the server.
   *
   * Demonstrates tRPC v11's native FormData support: the client sends a raw
   * `FormData` instance, which is validated server-side using
   * `zod-form-data`'s `zfd.formData`/`zfd.file` helpers.
   */
  uploadFile: publicProcedure
    .input(
      zfd.formData({
        file: zfd.file(),
      }),
    )
    .mutation(async ({ input }) => {
      const { file } = input;

      await ensureUploadDir();

      const filename = safeFilename(file.name || 'upload.bin');
      const filePath = path.join(UPLOAD_DIR, filename);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(filePath, buffer);

      const url = `/uploads/${filename}`;

      return {
        ok: true as const,
        url,
        filename,
        size: buffer.byteLength,
        type: file.type || 'application/octet-stream',
      };
    }),

  /** Simple health-check procedure */
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }).optional())
    .query(({ input }) => {
      return { greeting: `Hello, ${input?.name ?? 'world'}!` };
    }),
});

export type AppRouter = typeof appRouter;
