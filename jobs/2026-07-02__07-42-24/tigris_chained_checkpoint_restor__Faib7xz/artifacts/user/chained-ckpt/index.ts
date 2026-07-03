import * as fs from "node:fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { checkpoint, restore } from "@tigrisdata/agent-kit";
import { removeBucket } from "@tigrisdata/storage";

async function main() {
  try {
    // 1. Read the run ID and construct the normalized bucket name
    const runIdRaw = fs.readFileSync("/logs/artifacts/run-id", "utf8").trim();
    const bucketName = `harbor-awscli-${runIdRaw}`.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
    console.log(`Normalized bucket name: ${bucketName}`);

    // Initialize S3 compatible client
    const s3Client = new S3Client({
      endpoint: "https://t3.storage.dev",
      region: "auto",
      credentials: {
        accessKeyId: process.env.TIGRIS_STORAGE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY!,
      },
    });

    const config = {
      endpoint: "https://t3.storage.dev",
      accessKeyId: process.env.TIGRIS_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY,
    };

    // 1. Upload v1.txt with body "version=1"
    console.log(`Uploading key 'v1.txt' with body 'version=1' to bucket '${bucketName}'...`);
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: "v1.txt",
      Body: Buffer.from("version=1", "utf8"),
      ContentType: "text/plain",
    }));
    console.log("Uploaded v1.txt successfully.");

    // 2. Take a named checkpoint of the bucket
    console.log(`Taking named checkpoint 'before-mutation' for bucket '${bucketName}'...`);
    const checkpointRes = await checkpoint(bucketName, { name: "before-mutation", config });
    if (checkpointRes.error) {
      console.error("Checkpoint failed:", checkpointRes.error);
      process.exit(1);
    }
    const ckpt = checkpointRes.data;
    console.log(`Checkpoint created. Snapshot ID: ${ckpt.snapshotId}`);

    // 3. Mutate: Upload the same key v1.txt with body "version=2"
    console.log(`Mutating: Overwriting 'v1.txt' with body 'version=2' in bucket '${bucketName}'...`);
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: "v1.txt",
      Body: Buffer.from("version=2", "utf8"),
      ContentType: "text/plain",
    }));
    console.log("Mutated v1.txt successfully.");

    // 4. Restore the captured checkpoint into a new fork
    console.log(`Restoring checkpoint '${ckpt.snapshotId}' into fork 'rollback-recovery'...`);
    const restoreRes = await restore(bucketName, ckpt.snapshotId, { forkName: "rollback-recovery", config });
    if (restoreRes.error) {
      console.error("Restore failed:", restoreRes.error);
      process.exit(1);
    }
    const restored = restoreRes.data;
    console.log(`Restore completed. Recovery bucket: ${restored.bucket}`);

    // Write recovery.json
    const recoveryJsonPath = "/home/user/chained-ckpt/recovery.json";
    fs.writeFileSync(recoveryJsonPath, JSON.stringify({ recoveryBucket: restored.bucket }, null, 2) + "\n", "utf8");
    console.log(`Wrote recovery.json to ${recoveryJsonPath}`);

    // 5. Tear down the recovery fork
    console.log(`Tearing down the recovery fork bucket '${restored.bucket}'...`);
    const removeRes = await removeBucket(restored.bucket, { force: true, config });
    if (removeRes.error) {
      console.error("Failed to delete recovery bucket:", removeRes.error);
      process.exit(1);
    }
    console.log("Recovery fork bucket deleted successfully.");

    console.log("All actions completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("An unexpected error occurred:", err);
    process.exit(1);
  }
}

main();
