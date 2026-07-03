import { createForks, teardownForks, type Forks } from "@tigrisdata/agent-kit";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { readFile, writeFile } from "fs/promises";

const TIGRIS_ENDPOINT = "REDACTED";
const REGION = "REDACTED";
const RUN_ID_PATH = "/logs/artifacts/run-id";
const AUDIT_PATH = "/home/user/isolation/audit.json";

/** Normalize a string into a valid S3 bucket name (lowercase, alnum/dot/hyphen). */
function normalizeBucketName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-");
}

async function listKeys(client: S3Client, bucket: string): Promise<string[]> {
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
      if (obj.Key !== undefined) keys.push(obj.Key);
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys.sort();
}

async function main(): Promise<void> {
  // 1. Read run id and construct source bucket name.
  const runIdRaw = (await readFile(RUN_ID_PATH, "utf-8")).trim();
  const sourceBucketName = normalizeBucketName(
    `harbor-isolation-${runIdRaw}`,
  );
  const forkPrefix = normalizeBucketName(`audit-fork-${runIdRaw}`);

  const adminAccessKeyId = process.env.TIGRIS_STORAGE_ACCESS_KEY_ID;
  const adminSecretAccessKey = process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY;
  if (!adminAccessKeyId || !adminSecretAccessKey) {
    throw new Error(
      "Missing admin credentials (TIGRIS_STORAGE_ACCESS_KEY_ID / TIGRIS_STORAGE_SECRET_ACCESS_KEY)",
    );
  }

  const adminClient = new S3Client({
    endpoint: TIGRIS_ENDPOINT,
    region: REGION,
    credentials: {
      accessKeyId: adminAccessKeyId,
      secretAccessKey: adminSecretAccessKey,
    },
  });

  // 2. Create 3 forks in a single call, with Editor scoped credentials.
  const forkResp = await createForks(sourceBucketName, 3, {
    prefix: forkPrefix,
    credentials: { role: "Editor" },
  });
  if (forkResp.error) {
    throw new Error(`createForks failed: ${forkResp.error.message ?? forkResp.error}`);
  }
  const forkSet: Forks = forkResp.data;

  try {
    // 3. Build per-fork S3 clients and upload concurrently.
    const agentKeys = ["agent-1.out", "agent-2.out", "agent-3.out"];

    const forkClients = forkSet.forks.map((fork) => {
      if (!fork.credentials) {
        throw new Error(`Fork ${fork.bucket} is missing scoped credentials`);
      }
      return new S3Client({
        endpoint: TIGRIS_ENDPOINT,
        region: REGION,
        credentials: {
          accessKeyId: fork.credentials.accessKeyId,
          secretAccessKey: fork.credentials.secretAccessKey,
        },
      });
    });

    await Promise.all(
      forkSet.forks.map(async (fork, i) => {
        const client = forkClients[i];
        const key = agentKeys[i];
        await client.send(
          new PutObjectCommand({
            Bucket: fork.bucket,
            Key: key,
            Body: `output from agent ${i + 1} in fork ${fork.bucket}`,
            ContentType: "text/plain",
          }),
        );
      }),
    );

    // 4. Audit: list source + each fork.
    const sourceKeys = await listKeys(adminClient, sourceBucketName);

    const expectedSource = ["seed1.txt", "seed2.txt"].sort();
    const sourceSorted = [...sourceKeys].sort();
    if (
      sourceSorted.length !== expectedSource.length ||
      sourceSorted.some((k, i) => k !== expectedSource[i])
    ) {
      throw new Error(
        `Source bucket isolation violated. Expected ${JSON.stringify(
          expectedSource,
        )}, got ${JSON.stringify(sourceSorted)}`,
      );
    }

    const allAgentKeys = new Set(agentKeys);
    const forkResults: { bucket: string; keys: string[] }[] = [];

    for (let i = 0; i < forkSet.forks.length; i++) {
      const fork = forkSet.forks[i];
      const client = forkClients[i];
      const ownKey = agentKeys[i];
      const keys = await listKeys(client, fork.bucket);
      const sorted = [...keys].sort();

      const expected = [ownKey, "seed1.txt", "seed2.txt"].sort();
      if (
        sorted.length !== expected.length ||
        sorted.some((k, j) => k !== expected[j])
      ) {
        throw new Error(
          `Fork ${fork.bucket} (index ${i}) keys mismatch. Expected ${JSON.stringify(
            expected,
          )}, got ${JSON.stringify(sorted)}`,
        );
      }

      // Ensure no other fork's agent output leaked into this fork.
      for (const k of sorted) {
        if (allAgentKeys.has(k) && k !== ownKey) {
          throw new Error(
            `Isolation violated: fork ${fork.bucket} contains another fork's output ${k}`,
          );
        }
      }

      forkResults.push({ bucket: fork.bucket, keys: sorted });
    }

    // 5. Write audit report.
    const report = {
      source_keys: sourceSorted,
      fork_results: forkResults,
    };
    await writeFile(AUDIT_PATH, JSON.stringify(report, null, 2) + "\n", "utf-8");
    console.log("Audit report written to", AUDIT_PATH);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    // 6. Tear down forks (always).
    try {
      const td = await teardownForks(forkSet);
      if (td.error) {
        console.error(
          `teardownForks error: ${td.error.message ?? td.error}`,
        );
      } else {
        console.log("Forks torn down successfully.");
      }
    } catch (e) {
      console.error("teardownForks threw:", e);
    }
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });