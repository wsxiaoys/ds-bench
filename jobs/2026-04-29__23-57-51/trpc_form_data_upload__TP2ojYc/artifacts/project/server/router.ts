import { publicProcedure, router } from "./trpc";
import { zfd } from "zod-form-data";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const uploadSchema = zfd.formData({
  file: zfd.file(),
});

export const appRouter = router({
  uploadFile: publicProcedure
    .input(uploadSchema)
    .mutation(async ({ input }) => {
      const { file } = input;

      // Ensure uploads directory exists
      const uploadsDir = join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });

      // Generate a unique filename preserving the extension
      const ext = file.name.split(".").pop() ?? "bin";
      const filename = `${randomUUID()}.${ext}`;
      const filePath = join(uploadsDir, filename);

      // Write file to disk
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      const url = `/uploads/${filename}`;
      return { url, filename, originalName: file.name, size: file.size };
    }),
});

export type AppRouter = typeof appRouter;
