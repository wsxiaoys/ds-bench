'use strict';

const { Daytona } = require('@daytona/sdk');
const fs = require('fs');
const path = require('path');

async function main() {
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error('ZEALT_RUN_ID environment variable is not set');
  }

  const sandboxName = `exec-ts-${runId}`;
  const logFile = path.join(__dirname, 'output.log');

  // Initialise the Daytona client (reads DAYTONA_API_KEY automatically)
  const daytona = new Daytona();

  let sandbox = null;

  try {
    // 1. Create the sandbox
    console.log(`Creating sandbox: ${sandboxName}`);
    sandbox = await daytona.create({
      name: sandboxName,
      envVars: {
        ZEALT_RUN_ID: runId,
      },
    });
    console.log(`Sandbox created: ${sandbox.id}`);

    // 2. Run cat /etc/os-release
    console.log('Running: cat /etc/os-release');
    const osResult = await sandbox.process.executeCommand('cat /etc/os-release');
    const osOutput = osResult.result.trim();

    // 3. Run node --version
    console.log('Running: node --version');
    const nodeResult = await sandbox.process.executeCommand('node --version');
    const nodeOutput = nodeResult.result.trim();

    // 4. Run echo ${ZEALT_RUN_ID}
    console.log('Running: echo ${ZEALT_RUN_ID}');
    const echoResult = await sandbox.process.executeCommand('echo ${ZEALT_RUN_ID}');
    const echoOutput = echoResult.result.trim();

    // 5. Write results to the log file
    const logContent =
      `OS: ${osOutput}\n` +
      `NODE: ${nodeOutput}\n` +
      `ECHO: ${echoOutput}\n`;

    fs.writeFileSync(logFile, logContent, 'utf8');
    console.log(`Results written to ${logFile}`);
    console.log('---');
    console.log(logContent);
  } finally {
    // Always delete the sandbox
    if (sandbox) {
      console.log(`Deleting sandbox: ${sandboxName}`);
      await daytona.delete(sandbox);
      console.log('Sandbox deleted.');
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
