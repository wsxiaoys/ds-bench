const { Daytona } = require('@daytonaio/sdk');
const fs = require('fs');
const path = require('path');

async function main() {
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error('ZEALT_RUN_ID environment variable is not set');
  }

  const sandboxName = `create-sandbox-ts-${runId}`;
  console.log(`Creating sandbox with name: ${sandboxName}`);

  const daytona = new Daytona();

  const sandbox = await daytona.create({
    name: sandboxName,
    language: 'typescript',
  });

  const sandboxId = sandbox.id;
  console.log(`Sandbox created with ID: ${sandboxId}`);

  const logPath = path.join('/home/user/myproject', 'output.log');
  fs.writeFileSync(logPath, `Sandbox ID: ${sandboxId}\n`);
  console.log(`Sandbox ID written to ${logPath}`);

  await daytona.delete(sandbox);
  console.log(`Sandbox ${sandboxId} deleted successfully`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
