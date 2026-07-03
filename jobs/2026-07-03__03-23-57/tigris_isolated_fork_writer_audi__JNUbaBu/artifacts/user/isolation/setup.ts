import { createWorkspace } from '@tigrisdata/agent-kit';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';

function normalizeBucketName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
}

async function main() {
  const adminAccessKeyId = process.env.TIGRIS_STORAGE_ACCESS_KEY_ID;
  const adminSecretAccessKey = process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY;
  if (!adminAccessKeyId || !adminSecretAccessKey) {
    console.error("Admin credentials not set.");
    process.exit(1);
  }

  const runIdRaw = await fs.readFile('/logs/artifacts/run-id', 'utf-8');
  const runId = runIdRaw.trim();
  const sourceBucketName = normalizeBucketName(`harbor-isolation-${runId}`);

  console.log(`Setting up source bucket ${sourceBucketName}...`);

  const adminS3 = new S3Client({
    endpoint: "REDACTED",
    region: "REDACTED",
    credentials: {
      accessKeyId: adminAccessKeyId,
      secretAccessKey: adminSecretAccessKey,
    }
  });

  let exists = false;
  try {
    await adminS3.send(new ListObjectsV2Command({ Bucket: sourceBucketName }));
    exists = true;
    console.log(`Bucket ${sourceBucketName} already exists.`);
  } catch (err: any) {
    if (err?.name === "NoSuchBucket" || err?.message?.includes("NoSuchBucket") || err?.message?.includes("does not exist")) {
      exists = false;
    } else {
      console.error("Error checking bucket:", err);
      process.exit(1);
    }
  }

  if (!exists) {
    console.log(`Creating bucket ${sourceBucketName}...`);
    const createRes = await createWorkspace(sourceBucketName, {
      enableSnapshots: true,
      config: {
        accessKeyId: adminAccessKeyId,
        secretAccessKey: adminSecretAccessKey,
      }
    });

    if (createRes.error) {
      console.error("Error creating workspace:", createRes.error);
      process.exit(1);
    }

    console.log("Bucket created. Seeding files...");
    await adminS3.send(new PutObjectCommand({
      Bucket: sourceBucketName,
      Key: "seed1.txt",
      Body: "seed1 content",
    }));
    await adminS3.send(new PutObjectCommand({
      Bucket: sourceBucketName,
      Key: "seed2.txt",
      Body: "seed2 content",
    }));
    console.log("Seeding complete.");
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
