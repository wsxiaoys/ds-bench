import { Daytona, Image } from "@daytonaio/sdk";
import { promises as fs } from "node:fs";
import path from "node:path";

const outputPath = path.resolve("/home/user/myproject/output.log");

const run = async () => {
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error("ZEALT_RUN_ID environment variable is required.");
  }

  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY environment variable is required.");
  }

  const daytona = new Daytona({ apiKey });
  const image = Image.debianSlim("3.12").pipInstall(["flask", "click"]);
  const name = `decl-ts-${runId}`;

  let sandbox: Awaited<ReturnType<typeof daytona.create>> | null = null;

  try {
    sandbox = await daytona.create({
      name,
      image,
      timeout: 0,
    });

    const command =
      "python3 -c \"import flask, click; print('flask', flask.__version__); print('click', click.__version__)\"";

    const execResult = await sandbox.process.executeCommand(command);
    const stdout = execResult.result ?? "";

    const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      throw new Error(`Expected at least 2 lines of output, got: ${stdout}`);
    }

    await fs.writeFile(outputPath, `${lines[0]}\n${lines[1]}\n`, "utf8");
  } finally {
    if (sandbox) {
      await daytona.delete(sandbox);
    }
  }
};

run().catch(async (error) => {
  await fs.writeFile(outputPath, `Error: ${error instanceof Error ? error.message : String(error)}\n`, "utf8");
  process.exitCode = 1;
});
