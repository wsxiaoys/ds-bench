import { zfd } from "zod-form-data";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { writeFileToDisk } from "../utils/writeFileToDisk";

/**
 * Schema for the upload mutation's input. We accept a `FormData` payload
 * containing a single `file` field. `zfd.file()` validates that the value
 * extracted from the FormData entry is actually a `File` instance.
 */
const uploadFileSchema = zfd.formData({
  file: zfd.file(),
});

export const uploadRouter = createTRPCRouter({
  /**
   * Receive a `FormData` payload, write the uploaded file to
   * `public/uploads/...`, and return its public URL.
   */
  uploadFile: publicProcedure
    .input(uploadFileSchema)
    .mutation(async ({ input }) => {
      const result = await writeFileToDisk(input.file);
      return {
        url: result.url,
        name: result.name,
        size: result.size,
      };
    }),
});