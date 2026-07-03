import { readFileSync, writeFileSync } from "node:fs";
import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteBucketCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { checkpoint, restore } from "@tigrisdata/agent-kit";
import { removeBucket } from "@tigrisdata/storage";

const ENDPOINT = "REDACTED";
const REGION = "REDACTED";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeBucketName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
}

async function main() {
  const accessKeyId = getRequiredEnv("TIGRIS_STORAGE_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("TIGRIS_STORAGE_SECRET_ACCESS_KEY");

  // Step 1: Read run id and construct the bucket name.
  const runId = readFileSync("/logs/artifacts/run-id", "utf8").trim();
  const bucketName = normalizeBucketName(`harbor-awscli-${runId}`);
  console.log(`Using source bucket: ${bucketName}`);

  const s3 = new S3Client({
    endpoint: ENDPOINT,
    region: REGION,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const config = {
    endpoint: ENDPOINT,
    accessKeyId,
    secretAccessKey,
  };

  // Step 2: Upload v1.txt with body `version=1`.
  {
    const result = await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: "v1.txt",
        Body: "version=1",
      }),
    );
    console.log("Uploaded v1:", result);
  }

  // Step 3: Take a checkpoint.
  const { data: ckpt, error: ckptError } = await checkpoint(bucketName, {
    name: "before-mutation",
    config,
  });
  if (ckptError) {
    throw new Error(`Checkpoint failed: ${ckptError.message}`);
  }
  if (!ckpt) {
    throw new Error("Checkpoint returned no data");
  }
  console.log("Checkpoint created:", ckpt);

  // Step 4: Mutate by uploading v1.txt with body `version=2`.
  {
    const result = await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: "v1.txt",
        Body: "version=2",
      }),
    );
    console.log("Mutated to v2:", result);
  }

  // Step 5: Restore the checkpoint into a fork named "rollback-recovery".
  const { data: restored, error: restoreError } = await restore(
    bucketName,
    ckpt.snapshotId,
    { forkName: "rollback-recovery", config },
  );
  if (restoreError) {
    throw new Error(`Restore failed: ${restoreError.message}`);
  }
  if (!restored) {
    throw new Error("Restore returned no data");
  }
  console.log("Restored fork bucket:", restored.bucket);

  // Step 6: Write the recovery bucket name to recovery.json.
  writeFileSync(
    "/home/user/chained-ckpt/recovery.json",
    JSON.stringify({ recoveryBucket: restored.bucket }, null, 2) + "\n",
  );
  console.log("Wrote recovery.json");

  // Step 7: Tear down the recovery fork bucket.
  // First, empty it to be safe (in case it has objects), then delete.
  try {
    const listed = await s3.send(
      new ListObjectsV2Command({ Bucket: restored.bucket }),
    );
    const objects = listed.Contents ?? [];
    for (const obj of objects) {
      if (!obj.Key) continue;
      await s3.send(
        new DeleteObjectCommand({
          Bucket: restored.bucket,
          Key: obj.Key,
        }),
      );
    }
  } catch (err) {
    console.warn("Warning: failed to list/delete objects in recovery bucket:", err);
  }

  const { error: removeError } = await removeBucket(restored.bucket, { force: true, config });
  if (removeError) {
    throw new Error(`removeBucket failed: ${removeError.message}`);
  }
  console.log("Recovery bucket deleted.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
