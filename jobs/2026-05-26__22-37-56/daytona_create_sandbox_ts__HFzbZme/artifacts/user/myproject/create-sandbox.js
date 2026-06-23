const { Daytona } = require("@daytonaio/sdk");
const fs = require("fs/promises");

const LOG_PATH = "/home/user/myproject/output.log";

async function main() {
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error("ZEALT_RUN_ID environment variable is required");
  }

  const daytona = new Daytona();
  const sandboxName = `create-sandbox-ts-${runId}`;
  let sandbox;

  try {
    sandbox = await daytona.create({
      name: sandboxName,
      language: "typescript",
    });

    await fs.writeFile(LOG_PATH, `Sandbox ID: ${sandbox.id}\n`, "utf8");
  } finally {
    if (sandbox) {
      await daytona.delete(sandbox);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
