import { createTRPCRouter, publicProcedure } from "@/server/trpc";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { zfd } from "zod-form-data";

const uploadInputSchema = zfd.formData({
  file: zfd.file(),
});

export const appRouter = createTRPCRouter({
  uploadFile: publicProcedure.input(uploadInputSchema).mutation(async ({ input }) => {
    const file = input.file;

    if (!file.type.startsWith("image/")) {
      throw new Error("Only image uploads are supported.");
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const extension = path.extname(file.name) || ".bin";
    const safeBaseName = path
      .basename(file.name, extension)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "upload";
    const fileName = `${safeBaseName}-${randomUUID()}${extension.toLowerCase()}`;
    const filePath = path.join(uploadDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return {
      url: `/uploads/${fileName}`,
      fileName,
    };
  }),
});

export type AppRouter = typeof appRouter;
