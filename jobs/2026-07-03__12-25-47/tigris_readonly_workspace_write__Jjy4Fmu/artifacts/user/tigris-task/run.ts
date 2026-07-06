import { readFile, writeFile } from "node:fs/promises";
import { createWorkspace, createForks } from "@tigrisdata/agent-kit";
import { put, get } from "@tigrisdata/storage";

function fail(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function stringFromError(err: unknown): string {
  if (!err) return "Error: <empty>";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    const anyErr = err as Error & {
      code?: string;
      cause?: unknown;
      $metadata?: { httpStatusCode?: number };
    };
    const parts: string[] = [];
    parts.push(`${anyErr.name ?? "Error"}: ${anyErr.message ?? String(err)}`);
    if (anyErr.code) parts.push(`code=${anyErr.code}`);
    if (anyErr.$metadata?.httpStatusCode)
      parts.push(`httpStatusCode=${anyErr.$metadata.httpStatusCode}`);
    if (anyErr.cause) {
      try {
        parts.push(`cause=${JSON.stringify(anyErr.cause)}`);
      } catch {
        parts.push(`cause=${String(anyErr.cause)}`);
      }
    }
    try {
      // include full JSON as well so nested fields are reachable
      parts.push(`error=${JSON.stringify(err)}`);
    } catch {
      /* ignore */
    }
    return parts.join(" | ");
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function main() {
  // 1. Read run id
  const rawRunId = (await readFile("/logs/artifacts/run-id", "utf-8")).trim();
  const runId = rawRunId.toLowerCase();
  console.log(`run_id=${runId}`);

  // 2. Build workspace name
  const workspaceName = `harbor-ro-${runId}`;
  console.log(`workspaceName=${workspaceName}`);

  // 3. Create editor workspace
  const wsRes = await createWorkspace(workspaceName, {
    ttl: { days: 1 },
    enableSnapshots: true,
    credentials: { role: "Editor" },
  });
  if (wsRes.error) fail(`createWorkspace returned error: ${wsRes.error.message}`);
  if (!wsRes.data) fail("createWorkspace returned no data");
  if (!wsRes.data.credentials)
    fail(`createWorkspace data.credentials missing for ${workspaceName}`);
  const workspaceBucket = wsRes.data.bucket;
  const editorCreds = wsRes.data.credentials;
  console.log(
    `created workspace bucket=${workspaceBucket} key=${editorCreds.accessKeyId}`
  );

  // 4. Write notes/welcome.txt using editor creds
  const putRes = await put(
    "notes/welcome.txt",
    "hello readonly",
    {
      config: {
        bucket: workspaceBucket,
        accessKeyId: editorCreds.accessKeyId,
        secretAccessKey: editorCreds.secretAccessKey,
      },
    }
  );
  if (putRes.error)
    fail(`editor put failed: ${stringFromError(putRes.error)}`);
  console.log("editor put ok");

  // 5. Create ReadOnly fork
  const forkPrefix = `harbor-ro-${runId}-readonly`;
  const forkRes = await createForks(workspaceBucket, 1, {
    prefix: forkPrefix,
    credentials: { role: "ReadOnly" },
  });
  if (forkRes.error)
    fail(`createForks returned error: ${forkRes.error.message}`);
  if (!forkRes.data) fail("createForks returned no data");
  if (!forkRes.data.forks || forkRes.data.forks.length === 0)
    fail("createForks produced no forks");
  const fork = forkRes.data.forks[0];
  if (!fork) fail("createForks forks[0] missing");
  if (!fork.credentials)
    fail(`fork credentials missing for ${fork.bucket}`);
  const forkBucket = fork.bucket;
  const readonlyCreds = fork.credentials;
  console.log(
    `created readonly fork bucket=${forkBucket} key=${readonlyCreds.accessKeyId}`
  );

  // 6. Attempt forbidden write using readonly creds
  const forbiddenRes = await put(
    "notes/forbidden.txt",
    "should be rejected",
    {
      config: {
        bucket: forkBucket,
        accessKeyId: readonlyCreds.accessKeyId,
        secretAccessKey: readonlyCreds.secretAccessKey,
      },
    }
  );
  if (!forbiddenRes.error) {
    fail(
      `readonly put unexpectedly succeeded; data=${JSON.stringify(
        forbiddenRes.data
      )}`
    );
  }
  const denialStr = stringFromError(forbiddenRes.error);
  if (!denialStr || denialStr.length === 0)
    fail("readonly put returned empty error");
  console.log(`readonly put denied: ${denialStr}`);
  await writeFile(
    "/home/user/tigris-task/write-denial.log",
    denialStr,
    "utf-8"
  );

  // 7. Read notes/welcome.txt using readonly creds
  const getRes = await get("notes/welcome.txt", "string", {
    config: {
      bucket: forkBucket,
      accessKeyId: readonlyCreds.accessKeyId,
      secretAccessKey: readonlyCreds.secretAccessKey,
    },
  });
  if (getRes.error)
    fail(`readonly get failed: ${stringFromError(getRes.error)}`);
  const body = getRes.data;
  if (body !== "hello readonly")
    fail(`readonly get returned unexpected body: ${JSON.stringify(body)}`);
  await writeFile("/home/user/tigris-task/readback.txt", body, "utf-8");
  console.log("readonly get ok");

  console.log("all steps completed successfully");
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
