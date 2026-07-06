import { readFile, writeFile } from "node:fs/promises";
import { createWorkspace } from "@tigrisdata/agent-kit";
import { put } from "@tigrisdata/storage";

const RUN_ID_PATH = "/logs/artifacts/run-id";
const OUTPUT_LOG_PATH = "/home/user/tigris-task/output.log";

function normalizeBucketName(name: string): string {
  // S3 bucket names may only contain lowercase letters, numbers, dots, and hyphens.
  // Lowercase, then replace any other character with a hyphen.
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function exitWithError(message: string, detail?: unknown): Promise<never> {
  if (detail !== undefined) {
    // eslint-disable-next-line no-console
    console.error(`${message}:`, detail);
  } else {
    // eslint-disable-next-line no-console
    console.error(message);
  }
  process.exit(1);
}

async function main(): Promise<void> {
  // 1) Read the run id from disk.
  let runIdRaw: string;
  try {
    runIdRaw = await readFile(RUN_ID_PATH, "utf8");
  } catch (err) {
    await exitWithError(`Failed to read run id from ${RUN_ID_PATH}`, err);
  }
  const runId = runIdRaw.trim();
  if (!runId) {
    await exitWithError(`Run id file ${RUN_ID_PATH} is empty`);
  }

  // 2) Build the workspace name and normalize it for S3.
  const workspaceNameRaw = `harbor-ws-${runId}`;
  const workspaceName = normalizeBucketName(workspaceNameRaw);
  if (!workspaceName) {
    await exitWithError(`Workspace name resolved to empty string from "${workspaceNameRaw}"`);
  }

  // 3) Create the workspace with a scoped Editor access key.
  const workspaceResponse = await createWorkspace(workspaceName, {
    ttl: { days: 1 },
    credentials: { role: "Editor" },
  });

  if (workspaceResponse.error) {
    await exitWithError("createWorkspace returned an error", workspaceResponse.error);
  }

  const workspace = workspaceResponse.data;
  if (!workspace) {
    await exitWithError("createWorkspace returned no workspace data");
  }

  if (!workspace.credentials) {
    await exitWithError(
      `createWorkspace returned a workspace (bucket=${workspace.bucket}) without scoped credentials`,
    );
  }

  const { bucket } = workspace;
  const { accessKeyId, secretAccessKey } = workspace.credentials;

  if (!bucket) {
    await exitWithError("createWorkspace returned a workspace without a bucket name");
  }
  if (!accessKeyId || !secretAccessKey) {
    await exitWithError("createWorkspace returned incomplete scoped credentials");
  }

  // 4) Upload state.json using ONLY the scoped credentials.
  const body = `{"status":"ok","run":"${runId}"}`;
  const putResponse = await put("state.json", body, {
    contentType: "application/json",
    config: {
      bucket,
      accessKeyId,
      secretAccessKey,
    },
  });

  if (putResponse.error) {
    await exitWithError("Failed to upload state.json using scoped credentials", putResponse.error);
  }

  // 5) Surface the scoped access key id (different from the root key) and persist to output.log.
  // Print exactly one line so the verifier can capture the key from stdout.
  process.stdout.write(`${accessKeyId}\n`);
  try {
    await writeFile(OUTPUT_LOG_PATH, `${accessKeyId}\n`, "utf8");
  } catch (err) {
    await exitWithError(`Failed to write scoped access key id to ${OUTPUT_LOG_PATH}`, err);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Unexpected error in run.ts:", err);
  process.exit(1);
});
