import { readFile, writeFile } from "node:fs/promises";
import { createBucket, put, list } from "@tigrisdata/storage";

async function main() {
  // 1. Read the current run_id from /logs/artifacts/run-id
  let runIdRaw: string;
  try {
    runIdRaw = await readFile("/logs/artifacts/run-id", "utf-8");
  } catch (err) {
    console.error("Failed to read /logs/artifacts/run-id:", err);
    process.exit(1);
  }
  const runId = runIdRaw.trim();
  console.log(`Read run_id: "${runId}"`);

  // 2. Build and normalize the bucket name
  const rawBucketName = `harbor-tssdk-${runId}`.toLowerCase();
  const bucketName = rawBucketName.replace(/[^a-z0-9.-]/g, "-");
  console.log(`Using bucket name: "${bucketName}"`);

  // 3. Call createBucket to create that bucket
  console.log("Creating bucket...");
  const createRes = await createBucket(bucketName);
  if (createRes.error) {
    const errMsg = createRes.error.message.toLowerCase();
    const isAlreadyExists =
      errMsg.includes("alreadyexists") ||
      errMsg.includes("alreadyownedbyyou") ||
      errMsg.includes("already exists") ||
      errMsg.includes("conflict");
    if (!isAlreadyExists) {
      console.error("Failed to create bucket:", createRes.error);
      process.exit(1);
    } else {
      console.log("Bucket already exists (ignoring error).");
    }
  } else {
    console.log("Bucket created successfully.");
  }

  // 4. Call put three times to upload objects to the bucket
  const objects = [
    { path: "inbox/msg-1.json", body: JSON.stringify({ id: 1 }) },
    { path: "inbox/msg-2.json", body: JSON.stringify({ id: 2 }) },
    { path: "inbox/msg-3.json", body: JSON.stringify({ id: 3 }) },
  ];

  for (const obj of objects) {
    console.log(`Uploading ${obj.path}...`);
    const putRes = await put(obj.path, obj.body, {
      contentType: "application/json",
      config: { bucket: bucketName },
    });
    if (putRes.error) {
      console.error(`Failed to upload ${obj.path}:`, putRes.error);
      process.exit(1);
    }
    console.log(`Uploaded ${obj.path} successfully.`);
  }

  // 5. Call list with { prefix: "inbox/" }
  console.log("Listing objects under prefix 'inbox/'...");
  const listRes = await list({
    prefix: "inbox/",
    config: { bucket: bucketName },
  });
  if (listRes.error) {
    console.error("Failed to list objects:", listRes.error);
    process.exit(1);
  }

  const items = listRes.data.items || [];
  console.log(`Listed ${items.length} items.`);

  // 6. Write the resulting object names to /home/user/tigris-task/listing.txt
  const names = items.map((item) => item.name);
  const listingContent = names.join("\n");
  
  try {
    await writeFile("/home/user/tigris-task/listing.txt", listingContent, "utf-8");
    console.log("Wrote listing.txt successfully.");
  } catch (err) {
    console.error("Failed to write listing.txt:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled rejection in main:", err);
  process.exit(1);
});
