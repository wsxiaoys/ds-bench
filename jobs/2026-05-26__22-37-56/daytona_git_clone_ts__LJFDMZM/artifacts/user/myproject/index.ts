import { Daytona } from "@daytonaio/sdk";
import { promises as fs } from "fs";

const OUTPUT_LOG = "/home/user/myproject/output.log";
const REPO_URL = "https://github.com/octocat/Spoon-Knife";
const CLONE_PATH = "/home/daytona/spoon-knife";

async function main() {
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error("ZEALT_RUN_ID environment variable is required.");
  }

  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY environment variable is required.");
  }

  const client = new Daytona({
    apiKey,
    serverUrl: "REDACTED",
  });

  const sandboxName = `git-ts-${runId}`;
  let sandbox: Awaited<ReturnType<typeof client.sandbox.create>> | null = null;

  try {
    sandbox = await client.sandbox.create({ name: sandboxName });

    await sandbox.git.clone({
      url: REPO_URL,
      path: CLONE_PATH,
    });

    const status = await sandbox.git.status(CLONE_PATH);
    const branchName = status.currentBranch;

    const lsResult = await sandbox.process.executeCommand(
      `ls ${CLONE_PATH}`
    );
    const files = lsResult.result
      .split(/\s+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    const logLines = [`Branch: ${branchName}`, `Files: ${files.join(", ")}`];
    await fs.writeFile(OUTPUT_LOG, logLines.join("\n"), "utf8");
  } finally {
    if (sandbox) {
      await sandbox.delete();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
