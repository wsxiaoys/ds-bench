import { readFileSync, writeFileSync } from "node:fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { checkpoint, restore } from "@tigrisdata/agent-kit";
import { createBucket, getBucketInfo, removeBucket } from "@tigrisdata/storage";

const TIGRIS_ENDPOINT = "REDACTED";
const REGION = "REDACTED";

const accessKeyId = process.env.TIGRIS_STORAGE_ACCESS_KEY_ID;
const secretAccessKey = process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  console.error(
    "Missing Tigris credentials. Set TIGRIS_STORAGE_ACCESS_KEY_ID and TIGRIS_STORAGE_SECRET_ACCESS_KEY.",
  );
  process.exit(1);
}

// Shared Tigris config for the agent-kit / storage SDK calls (falls back to env
// vars, but we pass them explicitly for robustness).
const tigrisConfig = {
  endpoint: TIGRIS_ENDPOINT,
  accessKeyId,
  secretAccessKey,
};

// AWS S3 client pointed at the Tigris S3-compatible endpoint.
const s3 = new S3Client({
  region: REGION,
  endpoint: TIGRIS_ENDPOINT,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

async function putObject(bucket: string, key: string, body: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(body, "utf-8"),
      ContentType: "text/plain",
    }),
  );
}

function normalizeBucketName(name: string): string {
  // S3 bucket names: lowercase letters, numbers, dots, and hyphens only.
  return name.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
}

async function main(): Promise<void> {
  // 1. Read the run id and derive the bucket name.
  const runId = readFileSync("/logs/artifacts/run-id", "utf-8").trim();
  const rawBucketName = `harbor-awscli-${runId}`;
  const bucketName = normalizeBucketName(rawBucketName);
  console.log(`Run id: ${runId}`);
  console.log(`Source bucket: ${bucketName}`);

  // Ensure the source bucket exists with snapshots enabled. The task states the
  // bucket is provisioned REDACTEDmatically, but we tolerate the case where it has
  // not been created yet by creating it ourselves (with snapshots enabled). We
  // never delete the source bucket later.
  console.log("Ensuring source bucket exists with snapshots enabled...");
  const infoResult = await getBucketInfo(bucketName, { config: tigrisConfig });
  if (infoResult.error) {
    console.log(`Bucket not found (${infoResult.error.message}); creating it...`);
    const createResult = await createBucket(bucketName, {
      enableSnapshot: true,
      config: tigrisConfig,
    });
    if (createResult.error) {
      throw new Error(
        `Failed to create source bucket: ${createResult.error.message}`,
      );
    }
    console.log(
      `Created bucket (snapshots enabled: ${createResult.data.isSnapshotEnabled}).`,
    );
  } else {
    console.log("Source bucket already exists.");
  }

  // Upload v1: object key v1.txt, body "version=1" (no trailing newline).
  console.log("Uploading v1.txt (version=1)...");
  await putObject(bucketName, "v1.txt", "version=1");

  // 2. Checkpoint the bucket before the risky mutation.
  console.log('Taking checkpoint "before-mutation"...');
  const ckptResult = await checkpoint(bucketName, {
    name: "before-mutation",
    config: tigrisConfig,
  });
  if (ckptResult.error) {
    throw new Error(`Checkpoint failed: ${ckptResult.error.message}`);
  }
  const snapshotId = ckptResult.data.snapshotId;
  console.log(`Checkpoint snapshotId: ${snapshotId}`);

  // 3. Mutate: overwrite v1.txt with "version=2".
  console.log("Uploading v1.txt (version=2) — mutating source bucket...");
  await putObject(bucketName, "v1.txt", "version=2");

  // 4. Restore the checkpoint into a new fork bucket.
  console.log('Restoring checkpoint into fork "rollback-recovery"...');
  const restoreResult = await restore(bucketName, snapshotId, {
    forkName: "rollback-recovery",
    config: tigrisConfig,
  });
  if (restoreResult.error) {
    throw new Error(`Restore failed: ${restoreResult.error.message}`);
  }
  const recoveryBucket = restoreResult.data.bucket;
  console.log(`Recovery (fork) bucket: ${recoveryBucket}`);

  // Write the recovery bucket name to recovery.json.
  writeFileSync(
    "/home/user/chained-ckpt/recovery.json",
    JSON.stringify({ recoveryBucket }, null, 2) + "\n",
  );
  console.log("Wrote /home/user/chained-ckpt/recovery.json");

  // 5. Tear down the recovery fork bucket (do NOT touch the source bucket,
  //    its objects, or the snapshot).
  console.log(`Tearing down recovery fork bucket "${recoveryBucket}"...`);
  const teardownResult = await removeBucket(recoveryBucket, {
    force: true,
    config: tigrisConfig,
  });
  if (teardownResult.error) {
    throw new Error(
      `Failed to tear down recovery fork: ${teardownResult.error.message}`,
    );
  }
  console.log("Recovery fork deleted.");

  console.log("Done.");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });