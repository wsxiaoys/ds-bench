const { Daytona } = require('@daytonaio/sdk');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    // Read run-id from environment variable
    const runId = process.env.ZEALT_RUN_ID;
    if (!runId) {
      throw new Error('ZEALT_RUN_ID environment variable is not set');
    }

    console.log(`Run ID: ${runId}`);

    // Initialize the Daytona client (it will automatically pick up DAYTONA_API_KEY)
    const daytona = new Daytona();

    // Create a new sandbox
    const sandboxName = `create-sandbox-ts-${runId}`;
    console.log(`Creating sandbox: ${sandboxName}`);

    const sandbox = await daytona.create({
      name: sandboxName,
      language: 'typescript'
    });

    console.log(`Sandbox created with ID: ${sandbox.id}`);

    // Write the sandbox ID to the output log file
    const outputPath = '/home/user/myproject/output.log';
    fs.writeFileSync(outputPath, `Sandbox ID: ${sandbox.id}\n`);
    console.log(`Sandbox ID written to ${outputPath}`);

    // Delete the sandbox
    console.log('Deleting sandbox...');
    await daytona.delete(sandbox);
    console.log('Sandbox deleted successfully');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();