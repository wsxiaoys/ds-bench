import { readFile, writeFile } from "node:fs/promises";
import { S3Client, PutObjectCommand, DeleteBucketCommand } from "@aws-sdk/client-s3";
import { checkpoint, restore } from "@tigrisdata/agent-kit";

const ENDPOINT = "REDACTED";
const REGION = "REDACTED";

const accessKeyId = process.env.TIGRIS_STORAGE_ACCESS_KEY_ID;
const secretAccessKey = process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  throw new Error(
    "TIGRIS_STORAGE_ACCESS_KEY_ID and TIGRIS_STORAGE_SECRET_ACCESS_KEY must be set"
  );
}

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: REGION,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

const agentKitConfig = {
  endpoint: ENDPOINT,
  accessKeyId,
  secretAccessKey,
};

function normalizeBucketName(name: string): string {
  // S3 bucket names can only contain lowercase letters, numbers, dots, and hyphens.
  return name.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
}

async function putObject(bucket: string, key: string, body: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "text/plain",
    })
  );
}

async function main(): Promise<void> {
  // 1. Resolve run id and bucket name.
  const runId = (await readFile("/logs/artifacts/run-id", "utf8")).trim();
  const rawBucketName = `harbor-awscli-${runId}`;
  const bucketName = normalizeBucketName(rawBucketName);

  console.log(`[setup] runId=${runId}`);
  console.log(`[setup] bucket=${bucketName}`);

  // Upload v1.
  await putObject(bucketName, "v1.txt", "version=1");
  console.log(`[upload] v1.txt -> ${bucketName}`);

  // 2. Take a named checkpoint of the bucket.
  const { data: ckpt, error: ckptError } = await checkpoint(bucketName, {
    name: "before-mutation",
    config: agentKitConfig,
  });
  if (ckptError || !ckpt) {
    throw new Error(`checkpoint failed: ${ckptError?.message ?? "no data"}`);
  }
  console.log(`[checkpoint] snapshotId=${ckpt.snapshotId}`);

  // 3. Mutate: overwrite v1.txt with version=2.
  await putObject(bucketName, "v1.txt", "version=2");
  console.log(`[mutate] v1.txt -> ${bucketName} (version=2)`);

  // 4. Restore the checkpoint into a new fork.
  const { data: restored, error: restoreError } = await restore(
    bucketName,
    ckpt.snapshotId,
    { forkName: "rollback-recovery", config: agentKitConfig }
  );
  if (restoreError || !restored) {
    throw new Error(`restore failed: ${restoreError?.message ?? "no data"}`);
  }
  const recoveryBucket = restored.bucket;
  console.log(`[restore] recovery bucket=${recoveryBucket}`);

  // Persist the recovery bucket name to disk.
  await writeFile(
    "/home/user/chained-ckpt/recovery.json",
    JSON.stringify({ recoveryBucket }),
    "utf8"
  );
  console.log(`[recovery] wrote /home/user/chained-ckpt/recovery.json`);

  // 5. Tear down the recovery fork bucket.
  await s3.send(new DeleteBucketCommand({ Bucket: recoveryBucket }));
  console.log(`[teardown] deleted recovery bucket ${recoveryBucket}`);
}

main().catch((err) => {
  console.error("[error]", err);
  process.exit(1);
});