import type { RequestHandler } from "@builder.io/qwik-city";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { insertImage } from "../../../utils/db";

export const onPost: RequestHandler = async ({ request, redirect }) => {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as any;

    if (!file || typeof file === "string" || !file.name) {
      throw new Error("No image file provided");
    }

    const originalName = file.name;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate unique ID and filenames
    const originalExt = path.extname(originalName) || ".jpg";
    const uniqueId = crypto.randomUUID();
    const originalFilename = `${uniqueId}${originalExt}`;
    const optimizedFilename = `${uniqueId}.webp`;

    // Define storage directories
    const originalDir = "/home/user/qwik-app/public/gallery/original/";
    const optimizedDir = "/home/user/qwik-app/public/gallery/optimized/";

    // Ensure directories exist
    fs.mkdirSync(originalDir, { recursive: true });
    fs.mkdirSync(optimizedDir, { recursive: true });

    const originalFilePath = path.join(originalDir, originalFilename);
    const optimizedFilePath = path.join(optimizedDir, optimizedFilename);

    // Save original image to disk
    fs.writeFileSync(originalFilePath, buffer);

    // Optimize and convert to WebP using sharp
    const image = sharp(buffer);
    const metadata = await image.metadata();

    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    let targetWidth: number | undefined = undefined;
    let targetHeight: number | undefined = undefined;

    if (originalWidth > 800 || originalHeight > 800) {
      if (originalWidth >= originalHeight) {
        targetWidth = 800;
      } else {
        targetHeight = 800;
      }
    }

    let optimizedImage = image;
    if (targetWidth || targetHeight) {
      optimizedImage = optimizedImage.resize(targetWidth, targetHeight);
    }

    const optimizedBuffer = await optimizedImage.webp().toBuffer();

    // Save optimized image to disk
    fs.writeFileSync(optimizedFilePath, optimizedBuffer);

    // Get optimized dimensions
    const optimizedMetadata = await sharp(optimizedBuffer).metadata();
    const width = optimizedMetadata.width || 0;
    const height = optimizedMetadata.height || 0;

    // Define public paths
    const originalPath = `/gallery/original/${originalFilename}`;
    const optimizedPath = `/gallery/optimized/${optimizedFilename}`;

    // Insert into database
    await insertImage(originalName, originalPath, optimizedPath, width, height);

    // Redirect to /gallery
    throw redirect(303, "/gallery");
  } catch (err: any) {
    if (
      err &&
      (err.constructor?.name === "RedirectMessage" ||
        err.constructor?.name === "AbortMessage" ||
        err.status === 302 ||
        err.status === 303)
    ) {
      // It's a redirect, rethrow it so Qwik City can handle it
      throw err;
    }
    console.error("Upload error:", err);
    // Return HTML error page or redirect back with error query
    const errMsg = encodeURIComponent(err.message || "Failed to upload image");
    throw redirect(303, `/gallery?error=${errMsg}`);
  }
};
