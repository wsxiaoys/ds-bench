import { readFile, writeFile } from "node:fs/promises";
import { createWorkspace, createForks } from "@tigrisdata/agent-kit";
import { put, get } from "@tigrisdata/storage";

function normalizeBucketName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
}

function formatError(err: any): string {
  if (!err) return "No error";
  const parts: string[] = [];
  if (err instanceof Error) {
    parts.push(`Name: ${err.name}`);
    parts.push(`Message: ${err.message}`);
    if (err.stack) parts.push(`Stack: ${err.stack}`);
  } else if (typeof err === "object") {
    parts.push(`Raw Object: ${JSON.stringify(err)}`);
  } else {
    parts.push(`Raw Value: ${String(err)}`);
  }

  // Check common AWS / S3 error properties
  for (const key of ["code", "Code", "statusCode", "status", "$metadata", "cause", "message", "name"]) {
    if (err && typeof err === "object" && key in err) {
      parts.push(`${key}: ${JSON.stringify((err as any)[key])}`);
    }
  }

  if (err && typeof err === "object" && err.$metadata && typeof err.$metadata === "object") {
    for (const key of ["httpStatusCode", "requestId", "extendedRequestId", "cfId", "attempts", "totalRetryDelay"]) {
      if (key in err.$metadata) {
        parts.push(`$metadata.${key}: ${JSON.stringify(err.$metadata[key])}`);
      }
    }
  }

  try {
    parts.push(`Full JSON: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
  } catch (e) {
    parts.push(`Full JSON serialization failed: ${String(e)}`);
  }

  return parts.join("\n");
}

async function main() {
  try {
    // 1. Read the current run_id from /logs/artifacts/run-id and trim whitespace
    console.log("Reading run_id...");
    const runId = (await readFile("/logs/artifacts/run-id", "utf-8")).trim();
    console.log(`run_id: "${runId}"`);

    // 2. Build the editor workspace name as harbor-ro-${run_id} (lowercase run id)
    const workspaceName = normalizeBucketName(`harbor-ro-${runId}`);
    console.log(`Workspace name: "${workspaceName}"`);

    // 3. Call createWorkspace(workspaceName, { ttl: { days: 1 }, enableSnapshots: true, credentials: { role: "Editor" } })
    console.log("Creating editor workspace...");
    const workspaceRes = await createWorkspace(workspaceName, {
      ttl: { days: 1 },
      enableSnapshots: true,
      credentials: { role: "Editor" }
    });

    if (workspaceRes.error) {
      console.error("Failed to create workspace:", workspaceRes.error);
      process.exit(1);
    }

    const workspaceData = workspaceRes.data;
    if (!workspaceData || !workspaceData.credentials) {
      console.error("Workspace credentials missing in response:", workspaceData);
      process.exit(1);
    }

    const editorCredentials = workspaceData.credentials;
    const workspaceBucket = workspaceData.bucket;
    console.log(`Workspace created successfully. Bucket: "${workspaceBucket}"`);

    // 4. Using the editor credentials, call put to upload object key notes/welcome.txt
    console.log("Uploading notes/welcome.txt using editor credentials...");
    const putRes = await put("notes/welcome.txt", "hello readonly", {
      config: {
        bucket: workspaceBucket,
        accessKeyId: editorCredentials.accessKeyId,
        secretAccessKey: editorCredentials.secretAccessKey,
      }
    });

    if (putRes.error) {
      console.error("Failed to upload notes/welcome.txt:", putRes.error);
      process.exit(1);
    }
    console.log("Upload succeeded.");

    // 5. Call createForks(workspaceBucket, 1, { prefix: "harbor-ro-${run_id}-readonly", credentials: { role: "ReadOnly" } })
    const forkPrefix = normalizeBucketName(`harbor-ro-${runId}-readonly`);
    console.log(`Creating forks with prefix: "${forkPrefix}"...`);
    const forksRes = await createForks(workspaceBucket, 1, {
      prefix: forkPrefix,
      credentials: { role: "ReadOnly" }
    });

    if (forksRes.error) {
      console.error("Failed to create forks:", forksRes.error);
      process.exit(1);
    }

    const forkSet = forksRes.data;
    if (!forkSet || !forkSet.forks || forkSet.forks.length === 0 || !forkSet.forks[0]) {
      console.error("No forks returned in response:", forkSet);
      process.exit(1);
    }

    const fork = forkSet.forks[0];
    if (!fork.credentials) {
      console.error("Fork credentials missing:", fork);
      process.exit(1);
    }

    const readonlyCredentials = fork.credentials;
    const forkBucket = fork.bucket;
    console.log(`Fork created successfully. Bucket: "${forkBucket}"`);

    // 6. Using readonly credentials, attempt to put notes/forbidden.txt into fork bucket
    console.log("Attempting forbidden write to fork bucket...");
    const forbiddenPutRes = await put("notes/forbidden.txt", "should be rejected", {
      config: {
        bucket: forkBucket,
        accessKeyId: readonlyCredentials.accessKeyId,
        secretAccessKey: readonlyCredentials.secretAccessKey,
      }
    });

    if (!forbiddenPutRes.error) {
      console.error("Verification failure: Write to ReadOnly fork unexpectedly succeeded!");
      process.exit(1);
    }

    console.log("Forbidden write was correctly denied. Logging error details...");
    const denialContent = formatError(forbiddenPutRes.error);
    console.log(denialContent);
    await writeFile("/home/user/tigris-task/write-denial.log", denialContent, "utf-8");
    console.log("Error details written to /home/user/tigris-task/write-denial.log");

    // 7. Using readonly credentials, get notes/welcome.txt from fork bucket
    console.log("Reading back notes/welcome.txt from fork bucket...");
    const getRes = await get("notes/welcome.txt", "string", {
      config: {
        bucket: forkBucket,
        accessKeyId: readonlyCredentials.accessKeyId,
        secretAccessKey: readonlyCredentials.secretAccessKey,
      }
    });

    if (getRes.error) {
      console.error("Failed to read back notes/welcome.txt:", getRes.error);
      process.exit(1);
    }

    const welcomeBody = getRes.data;
    console.log(`Read back content: "${welcomeBody}"`);
    if (welcomeBody !== "hello readonly") {
      console.error(`Unexpected welcome body content: "${welcomeBody}"`);
      process.exit(1);
    }

    await writeFile("/home/user/tigris-task/readback.txt", welcomeBody, "utf-8");
    console.log("Content written to /home/user/tigris-task/readback.txt");

    console.log("All steps completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Unexpected error in main:", err);
    process.exit(1);
  }
}

main();
