const fs = require('fs');
const { Daytona } = require('@daytonaio/sdk');

const RUN_ID_PATH = '/logs/artifacts/run-id';
const OUTPUT_LOG_PATH = '/home/user/myproject/output.log';

async function main() {
  // Read the run-id from the artifacts directory.
  const runId = fs.readFileSync(RUN_ID_PATH, 'utf8').trim();
  const sandboxName = `create-sandbox-ts-${runId}`;
  console.log(`Using run-id: ${runId}`);
  console.log(`Sandbox name: ${sandboxName}`);

  // Initialize the Daytona client. It picks up DAYTONA_API_KEY from the environment REDACTEDmatically.
  const daytona = new Daytona();

  let sandbox;
  try {
    // Create a brand-new sandbox.
    console.log('Creating sandbox...');
    sandbox = await daytona.create({
      name: sandboxName,
      language: 'typescript',
    });

    console.log(`Sandbox created with id: ${sandbox.id}`);

    // Write the sandbox ID to the output log file.
    fs.writeFileSync(OUTPUT_LOG_PATH, `Sandbox ID: ${sandbox.id}\n`, 'utf8');
    console.log(`Wrote sandbox id to ${OUTPUT_LOG_PATH}`);
  } finally {
    // Clean up the sandbox so it does not consume quota.
    if (sandbox) {
      console.log('Deleting sandbox...');
      await daytona.delete(sandbox);
      console.log('Sandbox deleted.');
    }
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});