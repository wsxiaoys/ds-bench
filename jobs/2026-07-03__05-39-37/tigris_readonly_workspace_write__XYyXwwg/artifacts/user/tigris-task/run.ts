import { readFile, writeFile } from "node:fs/promises";
import { createWorkspace, createForks } from "@tigrisdata/agent-kit";
import { put, get } from "@tigrisdata/storage";

/**
 * Normalize an S3 bucket name: lowercase it and replace any character that
 * is not a lowercase letter, digit, dot, or hyphen with a hyphen.
 */
function normalizeBucketName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-");
}

/**
 * Recursively stringify an error (and any nested cause / AWS metadata)
 * so the resulting log line contains denial indicators such as
 * `AccessDenied`, `Forbidden`, `403`, `permission`, etc.
 */
function stringifyError(err: unknown): string {
  if (err == null) return "null";

  const parts: string[] = [];

  if (err instanceof Error) {
    parts.push(`${err.name ?? "Error"}: ${err.message ?? String(err)}`);
  } else if (typeof err === "string") {
    parts.push(err);
  } else {
    parts.push(JSON.stringify(err));
  }

  // Capture nested AWS / SDK fields that carry status codes / error codes.
  const anyErr = err as Record<string, unknown>;
  const fieldsToCapture = [
    "Code",
    "code",
    "$metadata",
    "$response",
    "$service",
    "RequestId",
    "requestId",
    "statusCode",
    "status",
    "message",
    "name",
    "cause",
    "Stack",
  ];

  for (const field of fieldsToCapture) {
    if (field in anyErr) {
      try {
        const val = anyErr[field];
        if (val !== undefined && val !== null) {
          parts.push(`${field}=${JSON.stringify(val, getCauseReplacer())}`);
        }
      } catch {
        parts.push(`${field}=${String(anyErr[field])}`);
      }
    }
  }

  return parts.join(" | ");
}

/** JSON replacer that follows `.cause` chains to surface nested errors. */
function getCauseReplacer(): (key: string, value: unknown) => unknown {
  const seen = new WeakSet<object>();
  return function replacer(key: string, value: unknown): unknown {
    if (key === "cause" && value instanceof Error) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
        ...(value as object),
      };
    }
    if (typeof value === "object" && value !== null) {
      if (seen.has(value as object)) return "[Circular]";
      seen.add(value as object);
    }
    return value;
  };
}

async function main(): Promise<void> {
  // 1. Read the current run_id from /logs/artifacts/run-id and trim whitespace.
  const runIdRaw = await readFile("/logs/artifacts/run-id", "utf-8");
  const runId = runIdRaw.trim();
  if (!runId) {
    console.error("run-id file is empty");
    process.exit(1);
  }

  // 2. Build the editor workspace name (lowercase run id).
  const workspaceName = `harbor-ro-${runId.toLowerCase()}`;
  console.log("Workspace name:", workspaceName);

  // 3. Create the editor workspace with Editor credentials, TTL, snapshots.
  const wsResult = await createWorkspace(workspaceName, {
    ttl: { days: 1 },
    enableSnapshots: true,
    credentials: { role: "Editor" },
  });

  if ("error" in wsResult && wsResult.error) {
    console.error("createWorkspace failed:", wsResult.error);
    process.exit(1);
  }

  const workspace = wsResult.data;
  if (!workspace || !workspace.credentials) {
    console.error("createWorkspace returned no credentials");
    process.exit(1);
  }

  const editorBucket = workspace.bucket;
  const editorCreds = workspace.credentials;
  console.log("Editor bucket:", editorBucket);
  console.log("Editor access key:", editorCreds.accessKeyId);

  // 4. Write notes/welcome.txt into the editor workspace using editor creds.
  const putResult = await put("notes/welcome.txt", "hello readonly", {
    config: {
      bucket: editorBucket,
      accessKeyId: editorCreds.accessKeyId,
      secretAccessKey: editorCreds.secretAccessKey,
    },
  });

  if ("error" in putResult && putResult.error) {
    console.error("Editor put failed:", putResult.error);
    process.exit(1);
  }

  console.log("Editor write succeeded:", putResult.data?.path);

  // 5. Create a single ReadOnly fork of the editor workspace.
  const forkPrefix = normalizeBucketName(
    `harbor-ro-${runId.toLowerCase()}-readonly`,
  );
  console.log("Fork prefix:", forkPrefix);

  const forkResult = await createForks(editorBucket, 1, {
    prefix: forkPrefix,
    credentials: { role: "ReadOnly" },
  });

  if ("error" in forkResult && forkResult.error) {
    console.error("createForks failed:", forkResult.error);
    process.exit(1);
  }

  const forkSet = forkResult.data;
  if (!forkSet || !forkSet.forks || !forkSet.forks[0] || !forkSet.forks[0].credentials) {
    console.error("createForks returned no fork or no credentials");
    process.exit(1);
  }

  const fork = forkSet.forks[0];
  const forkBucket = normalizeBucketName(fork.bucket);
  const readonlyCreds = fork.credentials;
  console.log("Fork bucket:", forkBucket);
  console.log("ReadOnly access key:", readonlyCreds.accessKeyId);

  // 6. Attempt a forbidden write with the ReadOnly credentials.
  const forbiddenPut = await put("notes/forbidden.txt", "should be rejected", {
    config: {
      bucket: forkBucket,
      accessKeyId: readonlyCreds.accessKeyId,
      secretAccessKey: readonlyCreds.secretAccessKey,
    },
  });

  if ("error" in forbiddenPut && forbiddenPut.error) {
    // Expected: the write was denied.
    const denial = stringifyError(forbiddenPut.error);
    console.log("ReadOnly write denied as expected:", denial);

    // Ensure the captured string contains an access-denial indicator.
    const denialIndicators = [
      "AccessDenied",
      "Forbidden",
      "not allowed",
      "permission",
      "403",
    ];
    const lowerDenial = denial.toLowerCase();
    const hasIndicator = denialIndicators.some((ind) =>
      lowerDenial.includes(ind.toLowerCase()),
    );
    if (!hasIndicator) {
      console.error(
        "Write failed but the error lacks an access-denial indicator:",
        denial,
      );
      process.exit(1);
    }

    if (!denial || denial.trim().length === 0) {
      console.error("Captured denial string is empty");
      process.exit(1);
    }

    await writeFile("/home/user/tigris-task/write-denial.log", denial, "utf-8");
    console.log("Wrote write-denial.log");
  } else {
    // Unexpected: the write succeeded — verification failure.
    console.error(
      "ERROR: ReadOnly write unexpectedly succeeded! This is a verification failure.",
    );
    process.exit(1);
  }

  // 7. Read notes/welcome.txt from the fork bucket using ReadOnly credentials.
  const getResult = await get("notes/welcome.txt", "string", {
    config: {
      bucket: forkBucket,
      accessKeyId: readonlyCreds.accessKeyId,
      secretAccessKey: readonlyCreds.secretAccessKey,
    },
  });

  if ("error" in getResult && getResult.error) {
    console.error("ReadOnly read failed:", getResult.error);
    process.exit(1);
  }

  const body = getResult.data;
  if (body !== "hello readonly") {
    console.error(
      `ReadOnly read returned unexpected body: "${body}" (expected "hello readonly")`,
    );
    process.exit(1);
  }

  // Write the returned body verbatim — no trailing newline, no extra whitespace.
  await writeFile("/home/user/tigris-task/readback.txt", body, "utf-8");
  console.log("Wrote readback.txt with body:", JSON.stringify(body));

  console.log("All steps completed successfully. Exiting 0.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});