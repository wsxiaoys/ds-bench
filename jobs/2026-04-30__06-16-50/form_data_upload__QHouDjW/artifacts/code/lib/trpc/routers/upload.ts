import { z } from "zod";
import { zfd } from "zod-form-data";
import { publicProcedure, router } from "../init";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const uploadRouter = router({
  uploadFile: publicProcedure
    .input(
      zfd.formData({
        file: zfd.file(),
      })
    )
    .mutation(async ({ input }) => {
      const file = input.file;
      const buffer = Buffer.from(await file.arrayBuffer());

      // Ensure the uploads directory exists
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });

      // Generate a unique filename to avoid collisions
      const timestamp = Date.now();
      const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `${timestamp}-${safeFilename}`;
      const filepath = path.join(uploadsDir, filename);

      await writeFile(filepath, buffer);

      return {
        success: true,
        url: `/uploads/${filename}`,
        filename: filename,
        originalName: file.name,
        size: buffer.length,
      };
    }),
});