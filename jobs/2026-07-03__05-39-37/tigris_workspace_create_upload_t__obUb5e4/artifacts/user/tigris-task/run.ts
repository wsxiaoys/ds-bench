import { readFile, writeFile } from "node:fs/promises";
import { createWorkspace } from "@tigrisdata/agent-kit";
import { put } from "@tigrisdata/storage";

async function main() {
  // 1. Read the current run_id and trim it.
  const runIdRaw = await readFile("/logs/artifacts/run-id", "utf8");
  const runId = runIdRaw.trim();

  // 2. Build the workspace name and normalize it to a valid S3 bucket name.
  //    S3 bucket names can only contain lowercase letters, numbers, dots,
  //    and hyphens.
  const rawName = `harbor-ws-${runId}`;
  const name = rawName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-");

  // 3. Create the workspace with a scoped Editor access key.
  const wsResult = await createWorkspace(name, {
    ttl: { days: 1 },
    credentials: { role: "Editor" },
  });

  if (wsResult.error) {
    console.error("createWorkspace error:", wsResult.error);
    process.exit(1);
  }

  const workspace = wsResult.data;

  if (
    !workspace ||
    !workspace.credentials ||
    !workspace.credentials.accessKeyId ||
    !workspace.credentials.secretAccessKey
  ) {
    console.error("createWorkspace returned no scoped credentials");
    process.exit(1);
  }

  const { bucket } = workspace;
  const { accessKeyId, secretAccessKey } = workspace.credentials;

  // 4. Upload the state object using ONLY the scoped credentials.
  const body = `{"status":"ok","run":"${runId}"}`;

  const putResult = await put("state.json", body, {
    contentType: "application/json",
    config: {
      bucket,
      accessKeyId,
      secretAccessKey,
    },
  });

  if (putResult.error) {
    console.error("put error:", putResult.error);
    process.exit(1);
  }

  // 5. Surface the scoped access key id.
  const scopedAccessKeyId = workspace.credentials.accessKeyId;
  console.log(scopedAccessKeyId);
  await writeFile("/home/user/tigris-task/output.log", scopedAccessKeyId + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});