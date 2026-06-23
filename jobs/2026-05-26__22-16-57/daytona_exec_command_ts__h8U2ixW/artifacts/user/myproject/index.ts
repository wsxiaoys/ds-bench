import { Daytona } from '@daytona/sdk';
import * as fs from 'fs';

// Get the run ID from environment variable
const runId = process.env.ZEALT_RUN_ID;

if (!runId) {
  console.error('Error: ZEALT_RUN_ID environment variable is not set');
  process.exit(1);
}

// Log file path
const logFilePath = '/home/user/myproject/output.log';

// Function to append to log file
function appendToLog(prefix: string, content: string): void {
  const logLine = `${prefix}${content}\n`;
  fs.appendFileSync(logFilePath, logLine, 'utf-8');
  console.log(logLine.trim());
}

async function main(): Promise<void> {
  const daytona = new Daytona();
  let sandbox;

  try {
    // Step 1: Create a new sandbox with name derived from run-id
    const sandboxName = `exec-ts-${runId}`;
    console.log(`Creating sandbox: ${sandboxName}`);
    
    sandbox = await daytona.create({
      name: sandboxName,
      envVars: {
        ZEALT_RUN_ID: runId as string
      }
    });
    
    console.log(`Sandbox created with ID: ${sandbox.id}`);

    // Step 2: Run cat /etc/os-release and record output
    console.log('Running: cat /etc/os-release');
    const osReleaseResponse = await sandbox.process.executeCommand('cat /etc/os-release');
    appendToLog('OS: ', osReleaseResponse.result);

    // Step 3: Run node --version and record output
    console.log('Running: node --version');
    const nodeVersionResponse = await sandbox.process.executeCommand('node --version');
    appendToLog('NODE: ', nodeVersionResponse.result);

    // Step 4: Run echo ${ZEALT_RUN_ID} and record output
    console.log(`Running: echo ${runId}`);
    const echoResponse = await sandbox.process.executeCommand(`echo ${runId}`);
    appendToLog('ECHO: ', echoResponse.result);

  } finally {
    // Step 5: Always delete the sandbox before exiting
    if (sandbox) {
      console.log(`Deleting sandbox: ${sandbox.id}`);
      await sandbox.delete();
      console.log('Sandbox deleted successfully');
    }
  }

  console.log(`Log file created at: ${logFilePath}`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});