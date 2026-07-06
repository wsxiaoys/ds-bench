// Create a Daytona sandbox via the official TypeScript SDK,
// log its UUID, and then delete it.

const fs = require('fs');
const path = require('path');
const { Daytona } = require('@daytonaio/sdk');

async function main() {
  // 1. Read the run-id from the artifacts directory.
  const runId = fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();
  const sandboxName = `create-sandbox-ts-${runId}`;

  // 2. Initialize the Daytona client. The SDK picks up DAYTONA_API_KEY
  //    from the environment REDACTEDmatically.
  const daytona = new Daytona();

  let sandbox;
  try {
    // 3. Create a fresh sandbox with the expected name and language.
    sandbox = await daytona.create({
      name: sandboxName,
      language: 'typescript',
    });

    const sandboxId = sandbox.id;
    if (!sandboxId) {
      throw new Error('Created sandbox has no id');
    }

    // 4. Write the UUID to the output log file.
    const outputPath = '/home/user/myproject/output.log';
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `Sandbox ID: ${sandboxId}\n`);
    console.log(`Sandbox ID: ${sandboxId}`);
  } finally {
    // 5. Always clean up so we don't burn quota.
    if (sandbox) {
      try {
        await daytona.delete(sandbox);
        console.log(`Deleted sandbox ${sandbox.id}`);
      } catch (cleanupErr) {
        console.error(`Failed to delete sandbox: ${cleanupErr}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});