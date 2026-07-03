import { readFile, writeFile } from "node:fs/promises";
import { createWorkspace } from "@tigrisdata/agent-kit";
import { put } from "@tigrisdata/storage";

async function main() {
  // 1. Read run_id and trim
  const runIdRaw = await readFile("/logs/artifacts/run-id", "utf8");
  const runId = runIdRaw.trim();

  // 2. Build normalized workspace name (lowercase, non-allowed chars -> hyphens)
  const rawName = `harbor-ws-${runId}`;
  const workspaceName = rawName
    .toLowerCase()
    .replace(/[^a-z0-9.\-]/g, "-");

  // 3. Create the workspace with scoped Editor credentials
  const wsResult = await createWorkspace(workspaceName, {
    ttl: { days: 1 },
    credentials: { role: "Editor" },
  });

  if (wsResult.error) {
    console.error("createWorkspace failed:", wsResult.error);
    process.exit(1);
  }
  if (!wsResult.data) {
    console.error("createWorkspace returned no data");
    process.exit(1);
  }

  const workspace = wsResult.data;

  if (!workspace.credentials) {
    console.error(
      "createWorkspace did not return scoped credentials; got:",
      workspace
    );
    process.exit(1);
  }

  const { accessKeyId, secretAccessKey } = workspace.credentials;

  if (!accessKeyId || !secretAccessKey) {
    console.error(
      "createWorkspace returned empty scoped credentials:",
      workspace.credentials
    );
    process.exit(1);
  }

  const bucket = workspace.bucket;

  // 4. Upload state.json using ONLY the scoped credentials
  const body = `{"status":"ok","run":"${runId}"}`;
  const putResult = await put(`state.json`, body, {
    contentType: "application/json",
    config: {
      bucket,
      accessKeyId,
      secretAccessKey,
    },
  });

  if (putResult.error) {
    console.error("put failed:", putResult.error);
    process.exit(1);
  }

  // 5. Print scoped access key id to stdout and to output.log
  const keyLine = `${accessKeyId}\n`;
  process.stdout.write(keyLine);
  await writeFile("/home/user/tigris-task/output.log", keyLine, "utf8");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
