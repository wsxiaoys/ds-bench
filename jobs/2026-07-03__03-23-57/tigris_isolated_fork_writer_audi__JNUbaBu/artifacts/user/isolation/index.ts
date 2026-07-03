import { createForks, teardownForks, Forks } from '@tigrisdata/agent-kit';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';

async function log(message: string, isError = false) {
  const formatted = `[${new Date().toISOString()}] ${message}\n`;
  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }
  await fs.appendFile('/home/user/isolation/output.log', formatted, 'utf-8');
}

async function listBucketKeys(s3Client: S3Client, bucketName: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined = undefined;
  
  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
    }));
    
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          keys.push(obj.Key);
        }
      }
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  return keys.sort();
}

function normalizeBucketName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
}

let forkSet: Forks | null = null;
let hasError = false;

const adminAccessKeyId = process.env.TIGRIS_STORAGE_ACCESS_KEY_ID;
const adminSecretAccessKey = process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY;

async function main() {
  try {
    // Clear and initialize log file
    await fs.writeFile('/home/user/isolation/output.log', `--- Isolation Audit Run Start: ${new Date().toISOString()} ---\n`, 'utf-8');
    await log("Initializing isolation audit...");

    if (!adminAccessKeyId || !adminSecretAccessKey) {
      throw new Error("Admin credentials (TIGRIS_STORAGE_ACCESS_KEY_ID / TIGRIS_STORAGE_SECRET_ACCESS_KEY) are not set in environment.");
    }

    // 1. Read run id and construct names
    const runIdRaw = await fs.readFile('/logs/artifacts/run-id', 'utf-8');
    const runId = runIdRaw.trim();
    if (!runId) {
      throw new Error("Run ID read from /logs/artifacts/run-id is empty.");
    }
    await log(`Read run ID: ${runId}`);

    const sourceBucketName = normalizeBucketName(`harbor-isolation-${runId}`);
    const forkPrefix = normalizeBucketName(`audit-fork-${runId}`);
    await log(`Constructed source bucket name: ${sourceBucketName}`);
    await log(`Constructed fork prefix: ${forkPrefix}`);

    // 2. Create 3 forks
    await log("Creating 3 forks of the source bucket...");
    const createResponse = await createForks(sourceBucketName, 3, {
      prefix: forkPrefix,
      credentials: { role: "Editor" },
      config: {
        accessKeyId: adminAccessKeyId,
        secretAccessKey: adminSecretAccessKey,
      }
    });

    if (createResponse.error) {
      throw createResponse.error;
    }

    forkSet = createResponse.data;
    await log(`Forks created successfully. Snapshot ID: ${forkSet.snapshotId}`);
    for (const [index, fork] of forkSet.forks.entries()) {
      await log(`Fork ${index}: bucket name = ${fork.bucket}`);
      if (!fork.credentials) {
        throw new Error(`Fork ${index} bucket ${fork.bucket} is missing credentials.`);
      }
    }

    // 3. Upload uniquely-named objects in parallel
    await log("Starting parallel uploads to each fork...");
    await Promise.all(
      forkSet.forks.map(async (fork, index) => {
        const s3Client = new S3Client({
          endpoint: "REDACTED",
          region: "REDACTED",
          credentials: {
            accessKeyId: fork.credentials!.accessKeyId,
            secretAccessKey: fork.credentials!.secretAccessKey,
          }
        });
        const key = `agent-${index + 1}.out`;
        await log(`Uploading ${key} to fork bucket ${fork.bucket}...`);
        await s3Client.send(new PutObjectCommand({
          Bucket: fork.bucket,
          Key: key,
          Body: `Hello from agent ${index + 1}`,
        }));
        await log(`Successfully uploaded ${key} to ${fork.bucket}`);
      })
    );
    await log("All parallel uploads completed.");

    // 4. Audit bucket state
    await log("Auditing source bucket and fork buckets...");
    
    // List source bucket using admin credentials
    const adminS3 = new S3Client({
      endpoint: "REDACTED",
      region: "REDACTED",
      credentials: {
        accessKeyId: adminAccessKeyId,
        secretAccessKey: adminSecretAccessKey,
      }
    });
    
    await log(`Listing source bucket ${sourceBucketName}...`);
    const sourceKeys = await listBucketKeys(adminS3, sourceBucketName);
    await log(`Source bucket keys: ${JSON.stringify(sourceKeys)}`);

    // List each fork bucket using its scoped credentials
    const forkResults: { bucket: string; keys: string[] }[] = [];
    for (const [index, fork] of forkSet.forks.entries()) {
      const forkS3 = new S3Client({
        endpoint: "REDACTED",
        region: "REDACTED",
        credentials: {
          accessKeyId: fork.credentials!.accessKeyId,
          secretAccessKey: fork.credentials!.secretAccessKey,
        }
      });
      await log(`Listing fork bucket ${fork.bucket}...`);
      const forkKeys = await listBucketKeys(forkS3, fork.bucket);
      await log(`Fork bucket ${fork.bucket} keys: ${JSON.stringify(forkKeys)}`);
      forkResults.push({
        bucket: fork.bucket,
        keys: forkKeys,
      });
    }

    // 5. Write audit report BEFORE teardown
    const auditReport = {
      source_keys: sourceKeys,
      fork_results: forkResults,
    };
    await log("Writing audit report to /home/user/isolation/audit.json...");
    await fs.writeFile('/home/user/isolation/audit.json', JSON.stringify(auditReport, null, 2), 'utf-8');
    await log("Audit report written successfully.");

    // 6. Assert isolation conditions
    await log("Asserting isolation conditions...");

    // - The source bucket does not contain exactly seed1.txt and seed2.txt.
    if (sourceKeys.length !== 2 || sourceKeys[0] !== "seed1.txt" || sourceKeys[1] !== "seed2.txt") {
      throw new Error(`Assertion failed: Source bucket does not contain exactly seed1.txt and seed2.txt. Found: ${JSON.stringify(sourceKeys)}`);
    }

    // - Any fork bucket does not contain exactly its own agent-N.out plus the two seed files.
    // - Any fork bucket contains another fork's agent-N.out.
    for (const [index, result] of forkResults.entries()) {
      const expectedAgentKey = `agent-${index + 1}.out`;
      const expectedKeys = [expectedAgentKey, "seed1.txt", "seed2.txt"].sort();
      
      if (result.keys.length !== expectedKeys.length ||
          result.keys.some((key, idx) => key !== expectedKeys[idx])) {
        throw new Error(`Assertion failed: Fork bucket ${result.bucket} does not contain exactly its own ${expectedAgentKey} plus the two seed files. Found: ${JSON.stringify(result.keys)}`);
      }
      
      const otherAgentKeys = [1, 2, 3].filter(n => n !== (index + 1)).map(n => `agent-${n}.out`);
      for (const otherKey of otherAgentKeys) {
        if (result.keys.includes(otherKey)) {
          throw new Error(`Assertion failed: Fork bucket ${result.bucket} contains another fork's object: ${otherKey}`);
        }
      }
    }

    await log("All isolation assertions passed successfully!");

  } catch (err: any) {
    hasError = true;
    await log(`CRITICAL ERROR: ${err?.message || err}`, true);
    if (err?.stack) {
      await log(err.stack, true);
    }
  } finally {
    if (forkSet) {
      try {
        await log("Tearing down forks...");
        const teardownResponse = await teardownForks(forkSet, {
          config: {
            accessKeyId: adminAccessKeyId,
            secretAccessKey: adminSecretAccessKey,
          }
        });
        if (teardownResponse.error) {
          await log(`Error during teardownForks: ${teardownResponse.error.message || teardownResponse.error}`, true);
          hasError = true;
        } else {
          await log("Teardown completed successfully.");
        }
      } catch (teardownErr: any) {
        await log(`Exception during teardownForks: ${teardownErr?.message || teardownErr}`, true);
        hasError = true;
      }
    }
    
    if (hasError) {
      await log("Run finished with errors.");
      process.exit(1);
    } else {
      await log("Run completed successfully with exit code 0.");
      process.exit(0);
    }
  }
}

main();
