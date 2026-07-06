import { readFile, writeFile } from "node:fs/promises";
import { createWorkspace } from "@tigrisdata/agent-kit";
import { put } from "@tigrisdata/storage";

async function main() {
  try {
    // 1. Read run_id
    const runIdRaw = await readFile("/logs/artifacts/run-id", "utf-8");
    const run_id = runIdRaw.trim();

    // 2. Normalize bucket name
    const rawName = `harbor-ws-${run_id}`;
    const bucketName = rawName.toLowerCase().replace(/[^a-z0-9.-]/g, "-");

    // 3. Create workspace
    const wsResult = await createWorkspace(bucketName, {
      ttl: { days: 1 },
      credentials: { role: "Editor" }
    });

    if (wsResult.error) {
      console.error("Failed to create workspace:", wsResult.error);
      process.exit(1);
    }

    const workspace = wsResult.data;
    if (!workspace || !workspace.credentials) {
      console.error("Workspace or credentials missing");
      process.exit(1);
    }

    // 4. Upload state.json using ONLY the scoped credentials
    const body = `{"status":"ok","run":"${run_id}"}`;
    const putResult = await put("state.json", body, {
      contentType: "application/json",
      config: {
        bucket: workspace.bucket,
        accessKeyId: workspace.credentials.accessKeyId,
        secretAccessKey: workspace.credentials.secretAccessKey,
      }
    });

    if (putResult.error) {
      console.error("Failed to upload state.json:", putResult.error);
      process.exit(1);
    }

    // 5. Output scoped accessKeyId
    const accessKeyId = workspace.credentials.accessKeyId;
    console.log(accessKeyId);
    await writeFile("/home/user/tigris-task/output.log", accessKeyId);

  } catch (err) {
    console.error("An unexpected error occurred:", err);
    process.exit(1);
  }
}

main();
