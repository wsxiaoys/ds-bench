import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import PocketBase from "pocketbase";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PB_URL = "http://127.0.0.1:8090";
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "adminpassword";
const COLLECTION = "gallery";
const THUMB_SIZE = "100x100";

const INPUT_PATH = path.join(__dirname, "input.jpg");
const THUMB_PATH = path.join(__dirname, "thumbnail.jpg");
const LOG_PATH = path.join(__dirname, "output.log");

async function main() {
  const pb = new PocketBase(PB_URL);

  // 1. Authenticate as the admin.
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  // 2. Upload input.jpg to create a new record in the gallery collection.
  const fileBuffer = await fs.readFile(INPUT_PATH);
  const file = new File([fileBuffer], "input.jpg", { type: "image/jpeg" });

  const record = await pb.collection(COLLECTION).create({ image: file });

  // The image field holds the stored filename string.
  const filename = record.image;
  if (!filename) {
    throw new Error("Upload succeeded but no image filename was returned.");
  }

  // 3. Build the 100x100 thumbnail URL.
  const thumbUrl = pb.files.getUrl(record, filename, { thumb: THUMB_SIZE });
  if (!thumbUrl) {
    throw new Error("Failed to construct the thumbnail URL.");
  }

  // 4. Download the thumbnail and save it as thumbnail.jpg.
  const response = await fetch(thumbUrl);
  if (!response.ok) {
    throw new Error(
      `Thumbnail download failed: ${response.status} ${response.statusText}`
    );
  }

  const thumbBuffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(THUMB_PATH, thumbBuffer);

  // Verify the thumbnail is smaller than the original.
  const originalSize = fileBuffer.length;
  const thumbSize = thumbBuffer.length;
  if (thumbSize >= originalSize) {
    throw new Error(
      `Thumbnail (${thumbSize} bytes) is not smaller than the original (${originalSize} bytes).`
    );
  }

  // 5. Write the created record ID to output.log.
  await fs.writeFile(LOG_PATH, `Record ID: ${record.id}`);

  console.log("Upload and thumbnail generation completed successfully.");
  console.log(`Record ID: ${record.id}`);
  console.log(`Thumbnail URL: ${thumbUrl}`);
  console.log(
    `Original size: ${originalSize} bytes | Thumbnail size: ${thumbSize} bytes`
  );
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});