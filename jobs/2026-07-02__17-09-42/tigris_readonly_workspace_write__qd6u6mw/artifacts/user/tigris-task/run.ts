import { readFile, writeFile } from "node:fs/promises";
import { createWorkspace, createForks } from "@tigrisdata/agent-kit";
import { put, get } from "@tigrisdata/storage";

// Convert any non-S3-safe chars (e.g. underscores) to hyphens so the resulting
// name is valid as an S3 bucket name (lowercase letters, numbers, dots, hyphens).
function normalizeBucketName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.\-]/g, "-");
}

async function main(): Promise<void> {
  // 1. Read run id
  const rawRunId = await readFile("/logs/artifacts/run-id", "utf-8");
  const runId = rawRunId.trim().toLowerCase();
  if (!runId) {
    console.error("run-id is empty");
    process.exit(1);
  }
  console.error(`run-id: ${runId}`);

  // 2. Build workspace name (lowercase run id)
  const workspaceName = `harbor-ro-${runId}`;
  console.error(`workspace name: ${workspaceName}`);

  // 3. Create the editor workspace
  const workspaceRes = await createWorkspace(workspaceName, {
    ttl: { days: 1 },
    enableSnapshots: true,
    credentials: { role: "Editor" },
  });
  if (workspaceRes.error) {
    console.error(`createWorkspace error: ${workspaceRes.error.message ?? workspaceRes.error}`);
    process.exit(1);
  }
  const workspaceBucket = workspaceRes.data?.bucket;
  const editorCredentials = workspaceRes.data?.credentials;
  if (!workspaceBucket || !editorCredentials) {
    console.error("createWorkspace returned no bucket/credentials");
    process.exit(1);
  }
  const { accessKeyId: editorAccessKeyId, secretAccessKey: editorSecretAccessKey } =
    editorCredentials;
  console.error(`workspace bucket: ${workspaceBucket}`);

  // 4. Editor: PUT notes/welcome.txt with body "hello readonly"
  const editorConfig = {
    bucket: workspaceBucket,
    accessKeyId: editorAccessKeyId,
    secretAccessKey: editorSecretAccessKey,
  };
  const putRes = await put("notes/welcome.txt", "hello readonly", {
    config: editorConfig,
  });
  if (putRes.error) {
    console.error(`editor put error: ${putRes.error.message ?? putRes.error}`);
    process.exit(1);
  }
  if (!putRes.data) {
    console.error("editor put returned no data");
    process.exit(1);
  }
  console.error(`editor put OK: ${JSON.stringify(putRes.data)}`);

  // 5. Mint a single ReadOnly fork of the workspace contents
  const forkPrefix = normalizeBucketName(`harbor-ro-${runId}-readonly`);
  const forkSetRes = await createForks(workspaceBucket, 1, {
    prefix: forkPrefix,
    credentials: { role: "ReadOnly" },
  });
  if (forkSetRes.error) {
    console.error(`createForks error: ${forkSetRes.error.message ?? forkSetRes.error}`);
    process.exit(1);
  }
  const forkSet = forkSetRes.data;
  if (!forkSet || !forkSet.forks || !forkSet.forks[0]) {
    console.error("createForks returned no forks[0]");
    process.exit(1);
  }
  const readonlyFork = forkSet.forks[0];
  const forkBucket = readonlyFork.bucket;
  const readonlyCredentials = readonlyFork.credentials;
  if (!forkBucket || !readonlyCredentials) {
    console.error("fork forks[0] missing bucket or credentials");
    process.exit(1);
  }
  const { accessKeyId: readonlyAccessKeyId, secretAccessKey: readonlySecretAccessKey } =
    readonlyCredentials;
  console.error(`fork bucket: ${forkBucket}`);

  const readonlyConfig = {
    bucket: forkBucket,
    accessKeyId: readonlyAccessKeyId,
    secretAccessKey: readonlySecretAccessKey,
  };

  // 6. ReadOnly credentials: attempt a forbidden PUT (must fail)
  const deniedPutRes = await put("notes/forbidden.txt", "should be rejected", {
    config: readonlyConfig,
  });
  if (!deniedPutRes.error) {
    console.error(
      "ERROR: readonly put unexpectedly succeeded; verification failure",
    );
    process.exit(1);
  }
  const err = deniedPutRes.error;
  const errName = err.name ?? "Error";
  const errMessage = err.message ?? String(err);
  let denial = `${errName}: ${errMessage}`;
  // Try to surface deeper AWS / HTTP error context if present
  const cause: unknown = (err as { cause?: unknown }).cause;
  if (cause) {
    if (cause instanceof Error) {
      denial += ` | cause: ${cause.name ?? "Error"}: ${cause.message ?? String(cause)}`;
    } else if (typeof cause === "object" && cause !== null) {
      denial += ` | cause: ${JSON.stringify(cause)}`;
    } else {
      denial += ` | cause: ${String(cause)}`;
    }
  }
  // Many AWS errors carry a Code / $metadata.httpStatusCode we want to log.
  const errAny = err as unknown as Record<string, unknown>;
  if (errAny.Code) {
    denial += ` | Code: ${String(errAny.Code)}`;
  }
  if (errAny.$metadata) {
    denial += ` | $metadata: ${JSON.stringify(errAny.$metadata)}`;
  }
  if (typeof errAny.statusCode === "number") {
    denial += ` | statusCode: ${errAny.statusCode}`;
  }
  if (!denial.includes("AccessDenied") && !denial.includes("Forbidden") &&
      !denial.includes("not allowed") && !denial.includes("permission") &&
      !denial.includes("403")) {
    console.error(`Warning: denial string lacks expected keywords: ${denial}`);
  }
  await writeFile("/home/user/tigris-task/write-denial.log", denial, "utf-8");
  console.error(`denial captured: ${denial}`);

  // 7. ReadOnly credentials: GET notes/welcome.txt (must succeed)
  const getRes = await get("notes/welcome.txt", "string", {
    config: readonlyConfig,
  });
  if (getRes.error) {
    console.error(`readonly get error: ${getRes.error.message ?? getRes.error}`);
    process.exit(1);
  }
  const body = getRes.data;
  if (typeof body !== "string") {
    console.error(`readonly get returned non-string body: ${typeof body}`);
    process.exit(1);
  }
  if (body !== "hello readonly") {
    console.error(`readonly get returned unexpected body: ${JSON.stringify(body)}`);
    process.exit(1);
  }
  await writeFile("/home/user/tigris-task/readback.txt", body, "utf-8");
  console.error(`readback OK: ${JSON.stringify(body)}`);
}

main().catch((e: unknown) => {
  const err = e instanceof Error ? e : new Error(String(e));
  console.error(`unhandled error: ${err.name ?? "Error"}: ${err.message ?? String(err)}`);
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
