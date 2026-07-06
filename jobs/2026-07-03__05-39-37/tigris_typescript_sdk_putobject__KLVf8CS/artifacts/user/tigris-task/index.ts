import { readFile, writeFile } from "node:fs/promises";
import { createBucket, put, list } from "@tigrisdata/storage";

async function main(): Promise<void> {
  // 1. Read the current run_id.
  const runId = (await readFile("/logs/artifacts/run-id", "utf-8")).trim();

  // 2. Build the bucket name, normalizing to valid S3 bucket name characters
  //    (lowercase letters, numbers, dots, hyphens only).
  const bucketName = `harbor-tssdk-${runId}`
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-");

  // 3. Create the bucket. If it already exists, treat that as success.
  const createResult = await createBucket(bucketName);
  if (createResult.error) {
    const message = String(createResult.error.message ?? createResult.error);
    // BucketAlreadyExists / AlreadyOwnedByYou -> treat as success.
    if (!/already exist|already owned|bucketalreadyexist/i.test(message)) {
      console.error(`createBucket failed: ${message}`);
      process.exit(1);
    }
  }

  // 4. Upload three JSON messages to the bucket.
  const messages: Array<{ key: string; body: string }> = [
    { key: "inbox/msg-1.json", body: '{"id": 1}' },
    { key: "inbox/msg-2.json", body: '{"id": 2}' },
    { key: "inbox/msg-3.json", body: '{"id": 3}' },
  ];

  for (const { key, body } of messages) {
    const putResult = await put(key, body, {
      contentType: "application/json",
      config: { bucket: bucketName },
    });
    if (putResult.error) {
      console.error(`put ${key} failed: ${putResult.error.message}`);
      process.exit(1);
    }
  }

  // 5. List objects under the inbox/ prefix and write their names to listing.txt.
  const listResult = await list({
    prefix: "inbox/",
    config: { bucket: bucketName },
  });
  if (listResult.error) {
    console.error(`list failed: ${listResult.error.message}`);
    process.exit(1);
  }

  const names = (listResult.data.items ?? []).map((item) => item.name);
  await writeFile(
    "/home/user/tigris-task/listing.txt",
    names.join("\n") + (names.length > 0 ? "\n" : ""),
    "utf-8",
  );

  console.log(`Bucket: ${bucketName}`);
  console.log(`Uploaded ${messages.length} objects.`);
  console.log(`Listed ${names.length} objects:`);
  for (const name of names) {
    console.log(`  ${name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});