import { zfd } from "zod-form-data";
import path from "path";
import { promises as fs } from "fs";
import { publicProcedure, router } from "./trpc";

export const appRouter = router({
  uploadFile: publicProcedure
    .input(
      zfd.formData({
        file: zfd.file(),
      })
    )
    .mutation(async ({ input }) => {
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadDir, { recursive: true });

      const buffer = Buffer.from(await input.file.arrayBuffer());
      const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const filename = `${Date.now()}-${safeName}`;
      const filePath = path.join(uploadDir, filename);

      await fs.writeFile(filePath, buffer);

      return {
        url: `/uploads/${filename}`,
      };
    }),
});

export type AppRouter = typeof appRouter;
