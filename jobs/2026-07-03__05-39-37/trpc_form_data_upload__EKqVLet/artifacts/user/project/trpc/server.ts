import { initTRPC } from "@trpc/server";
import { zfd } from "zod-form-data";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const t = initTRPC.create();

export const appRouter = t.router({
  uploadFile: t.procedure
    .input(
      zfd.formData({
        file: zfd.file(),
      }),
    )
    .mutation(async ({ input }) => {
      const file = input.file;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `${Date.now()}-${safeName}`;

      await writeFile(path.join(uploadDir, filename), buffer);

      return { url: `/uploads/${filename}` };
    }),
});

export type AppRouter = typeof appRouter;