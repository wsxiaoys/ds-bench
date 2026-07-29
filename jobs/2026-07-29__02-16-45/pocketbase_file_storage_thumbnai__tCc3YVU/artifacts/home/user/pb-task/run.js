const fs = require("fs");
const path = require("path");
const PocketBase = require("pocketbase/cjs");

const PB_URL = "http://127.0.0.1:8090";
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "adminpassword";

const INPUT_IMAGE = path.join(__dirname, "input.jpg");
const OUTPUT_THUMBNAIL = path.join(__dirname, "thumbnail.jpg");
const OUTPUT_LOG = path.join(__dirname, "output.log");

async function main() {
  const pb = new PocketBase(PB_URL);

  // 1. Authenticate as the admin (superuser).
  await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  // 2. Upload input.jpg to create a new record in the `gallery` collection.
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(INPUT_IMAGE);
  const fileBlob = new Blob([fileBuffer], { type: "image/jpeg" });
  formData.append("image", fileBlob, "input.jpg");

  const record = await pb.collection("gallery").create(formData);

  // 3. Get the URL for the 100x100 thumbnail of the uploaded image.
  const thumbnailUrl = pb.files.getURL(record, record.image, { thumb: "100x100" });

  // 4. Download the thumbnail and save it as thumbnail.jpg.
  const response = await fetch(thumbnailUrl);
  if (!response.ok) {
    throw new Error(`Failed to download thumbnail: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(OUTPUT_THUMBNAIL, Buffer.from(arrayBuffer));

  // 5. Write the created record ID to output.log.
  fs.writeFileSync(OUTPUT_LOG, `Record ID: ${record.id}\n`);

  console.log(`Record ID: ${record.id}`);
  console.log(`Thumbnail saved to: ${OUTPUT_THUMBNAIL}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
