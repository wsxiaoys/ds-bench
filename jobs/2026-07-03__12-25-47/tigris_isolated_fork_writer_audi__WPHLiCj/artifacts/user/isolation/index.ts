import { readFile, writeFile } from 'fs/promises';
import { createForks, teardownForks } from '@tigrisdata/agent-kit';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

// 1. Read run id
const runId = (await readFile('/logs/artifacts/run-id', 'utf-8')).trim();

function normalizeBucketName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
}

const sourceBucketName = normalizeBucketName(`harbor-isolation-${runId}`);
const forkPrefix = normalizeBucketName(`audit-fork-${runId}`);

const TIGRIS_ENDPOINT = 'REDACTED';

async function listKeys(client: S3Client, bucket: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined = undefined;
  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of resp.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys.sort();
}

async function main(): Promise<void> {
  let forkSet: any = undefined;
  try {
    // 2. Create 3 forks
    const { data, error } = await createForks(sourceBucketName, 3, {
      prefix: forkPrefix,
      credentials: { role: 'Editor' },
    });
    if (error) {
      throw new Error(`createForks failed: ${error.message}`);
    }
    if (!data) {
      throw new Error('createForks returned no data');
    }
    forkSet = data;
    console.log('Created forks:', forkSet.forks.map((f: any) => f.bucket));

    // 3. Upload to each fork in parallel using scoped credentials
    const uploadPromises = forkSet.forks.map(async (fork: any, idx: number) => {
      if (!fork.credentials) {
        throw new Error(`fork ${idx} has no credentials`);
      }
      const client = new S3Client({
        endpoint: TIGRIS_ENDPOINT,
        region: 'REDACTED',
        credentials: {
          accessKeyId: fork.credentials.accessKeyId,
          secretAccessKey: fork.credentials.secretAccessKey,
        },
        forcePathStyle: true,
      });
      const key = `agent-${idx + 1}.out`;
      await client.send(
        new PutObjectCommand({
          Bucket: fork.bucket,
          Key: key,
          Body: `output from agent ${idx + 1}\n`,
        }),
      );
      console.log(`Uploaded ${key} to ${fork.bucket}`);
    });
    await Promise.all(uploadPromises);

    // 4. Audit
    const adminAccessKeyId = process.env.TIGRIS_STORAGE_ACCESS_KEY_ID;
    const adminSecretAccessKey = process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY;
    if (!adminAccessKeyId || !adminSecretAccessKey) {
      throw new Error('Admin Tigris credentials not set in env');
    }
    const adminClient = new S3Client({
      endpoint: TIGRIS_ENDPOINT,
      region: 'REDACTED',
      credentials: {
        accessKeyId: adminAccessKeyId,
        secretAccessKey: adminSecretAccessKey,
      },
      forcePathStyle: true,
    });

    const sourceKeys = await listKeys(adminClient, sourceBucketName);
    console.log('Source keys:', sourceKeys);

    if (sourceKeys.length !== 2 || !sourceKeys.includes('seed1.txt') || !sourceKeys.includes('seed2.txt')) {
      throw new Error(
        `Source bucket does not contain exactly [seed1.txt, seed2.txt], got: ${JSON.stringify(sourceKeys)}`,
      );
    }

    const forkResults: Array<{ bucket: string; keys: string[] }> = [];
    for (let i = 0; i < forkSet.forks.length; i++) {
      const fork = forkSet.forks[i];
      if (!fork.credentials) {
        throw new Error(`fork ${i} has no credentials`);
      }
      const forkClient = new S3Client({
        endpoint: TIGRIS_ENDPOINT,
        region: 'REDACTED',
        credentials: {
          accessKeyId: fork.credentials.accessKeyId,
          secretAccessKey: fork.credentials.secretAccessKey,
        },
        forcePathStyle: true,
      });
      const keys = await listKeys(forkClient, fork.bucket);
      console.log(`Fork ${i} (${fork.bucket}) keys:`, keys);

      const expectedAgentKey = `agent-${i + 1}.out`;
      const expectedKeys = [expectedAgentKey, 'seed1.txt', 'seed2.txt'].sort();
      if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
        throw new Error(
          `Fork ${i} (${fork.bucket}) isolation invariant violated. Expected ${JSON.stringify(expectedKeys)}, got ${JSON.stringify(keys)}`,
        );
      }
      for (let j = 0; j < forkSet.forks.length; j++) {
        if (j === i) continue;
        const otherAgentKey = `agent-${j + 1}.out`;
        if (keys.includes(otherAgentKey)) {
          throw new Error(
            `Fork ${i} (${fork.bucket}) contains another fork's key ${otherAgentKey}`,
          );
        }
      }
      forkResults.push({ bucket: fork.bucket, keys });
    }

    const auditReport = {
      source_keys: sourceKeys,
      fork_results: forkResults,
    };
    await writeFile(
      '/home/user/isolation/audit.json',
      JSON.stringify(auditReport, null, 2),
      'utf-8',
    );
    console.log('Wrote audit.json');
  } finally {
    if (forkSet) {
      console.log('Tearing down forks...');
      const result = await teardownForks(forkSet);
      if (result.error) {
        console.error('Teardown error:', result.error.message);
      } else {
        console.log('Teardown complete');
      }
    }
  }
}

main()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
