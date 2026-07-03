import { readFile, writeFile } from "fs/promises";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { createForks, teardownForks, type Forks } from "@tigrisdata/agent-kit";

const ENDPOINT = "REDACTED";
const REGION = "REDACTED";
const FORK_COUNT = 3;

// S3 bucket name normalization: lowercase, replace any character that is not
// [a-z0-9.-] with a hyphen.
function normalizeBucketName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.\-]/g, "-");
}

async function readRunId(): Promise<string> {
  return (await readFile("/logs/artifacts/run-id", "utf8")).trim();
}

function makeClient(
  accessKeyId: string,
  secretAccessKey: string,
): S3Client {
  return new S3Client({
    endpoint: ENDPOINT,
    region: REGION,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

async function listAllKeys(client: S3Client, bucket: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys.sort();
}

async function main(): Promise<void> {
  const runId = await readRunId();
  const sourceBucket = normalizeBucketName(`harbor-isolation-${runId}`);
  const forkPrefix = normalizeBucketName(`audit-fork-${runId}`);

  console.log(`source bucket: ${sourceBucket}`);
  console.log(`fork prefix:   ${forkPrefix}`);

  const forkSetResult = await createForks(sourceBucket, FORK_COUNT, {
    prefix: forkPrefix,
    credentials: { role: "Editor" },
  });
  if (forkSetResult.error) {
    throw new Error(`createForks failed: ${forkSetResult.error.message}`);
  }
  const forkSet: Forks = forkSetResult.data;

  try {
    const uploads = forkSet.forks.map((fork, index) => {
      if (!fork.credentials) {
        throw new Error(
          `fork ${index} (${fork.bucket}) is missing scoped credentials`,
        );
      }
      const client = makeClient(
        fork.credentials.accessKeyId,
        fork.credentials.secretAccessKey,
      );
      const key = `agent-${index + 1}.out`;
      return client
        .send(
          new PutObjectCommand({
            Bucket: fork.bucket,
            Key: key,
            Body: `output from fork ${index + 1}`,
          }),
        )
        .finally(() => client.destroy());
    });
    await Promise.all(uploads);

    // Audit the source bucket using admin credentials.
    const adminClient = makeClient(
      process.env.TIGRIS_STORAGE_ACCESS_KEY_ID ?? "",
      process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY ?? "",
    );
    const sourceKeys = await listAllKeys(adminClient, sourceBucket);
    adminClient.destroy();

    const sourceExpected = ["seed1.txt", "seed2.txt"];
    if (
      sourceKeys.length !== sourceExpected.length ||
      !sourceExpected.every((k) => sourceKeys.includes(k))
    ) {
      throw new Error(
        `source bucket ${sourceBucket} key mismatch: expected ${JSON.stringify(
          sourceExpected,
        )} sorted, got ${JSON.stringify(sourceKeys)}`,
      );
    }

    const forkResults: { bucket: string; keys: string[] }[] = [];
    for (let i = 0; i < forkSet.forks.length; i++) {
      const fork = forkSet.forks[i];
      if (!fork.credentials) {
        throw new Error(
          `fork ${i} (${fork.bucket}) is missing scoped credentials`,
        );
      }
      const forkClient = makeClient(
        fork.credentials.accessKeyId,
        fork.credentials.secretAccessKey,
      );
      const keys = await listAllKeys(forkClient, fork.bucket);
      forkClient.destroy();

      const expectedOwn = `agent-${i + 1}.out`;
      const expected = [expectedOwn, "seed1.txt", "seed2.txt"];

      // Must contain exactly the expected three keys.
      if (
        keys.length !== expected.length ||
        !expected.every((k) => keys.includes(k))
      ) {
        throw new Error(
          `fork ${i} (${fork.bucket}) key mismatch: expected ${JSON.stringify(
            expected,
          )} sorted, got ${JSON.stringify(keys)}`,
        );
      }

      // Must NOT contain any other fork's agent-N.out key.
      for (let j = 0; j < forkSet.forks.length; j++) {
        if (j === i) continue;
        const foreign = `agent-${j + 1}.out`;
        if (keys.includes(foreign)) {
          throw new Error(
            `isolation violation: fork ${i} (${fork.bucket}) contains foreign key ${foreign} from fork ${j}`,
          );
        }
      }

      forkResults.push({ bucket: fork.bucket, keys });
    }

    const report = { source_keys: sourceKeys, fork_results: forkResults };
    await writeFile(
      "/home/user/isolation/audit.json",
      JSON.stringify(report, null, 2),
      "utf8",
    );
    console.log("wrote /home/user/isolation/audit.json");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    const teardownResult = await teardownForks(forkSet);
    if (teardownResult.error) {
      console.error(
        `teardownForks reported error: ${teardownResult.error.message}`,
      );
    } else {
      console.log("teardownForks complete");
    }
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("fatal:", err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  });
