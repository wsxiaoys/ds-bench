const fs = require('fs');
const path = require('path');
const { Daytona } = require('@daytonaio/sdk');

async function main() {
  try {
    // Read run-id
    const runIdPath = '/logs/artifacts/run-id';
    if (!fs.existsSync(runIdPath)) {
      throw new Error(`Run ID file not found at ${runIdPath}`);
    }
    const runId = fs.readFileSync(runIdPath, 'utf8').trim();
    console.log(`Read run-id: ${runId}`);

    const sandboxName = `create-sandbox-ts-${runId}`;
    console.log(`Creating sandbox with name: ${sandboxName}`);

    // Initialize Daytona client
    const daytona = new Daytona();

    // Create sandbox
    const sandbox = await daytona.create({
      name: sandboxName,
      language: 'typescript'
    });

    const sandboxId = sandbox.id;
    console.log(`Sandbox created successfully. ID: ${sandboxId}`);

    // Write sandbox ID to /home/user/myproject/output.log
    const outputPath = '/home/user/myproject/output.log';
    fs.writeFileSync(outputPath, `Sandbox ID: ${sandboxId}\n`, 'utf8');
    console.log(`Wrote ID to ${outputPath}`);

    // Delete the sandbox
    console.log(`Deleting sandbox...`);
    await daytona.delete(sandbox);
    console.log(`Sandbox deleted successfully.`);

  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

main();
