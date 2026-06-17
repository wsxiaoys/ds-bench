import { Daytona } from '@daytonaio/sdk';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error('ZEALT_RUN_ID environment variable is not set');
  }

  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error('DAYTONA_API_KEY environment variable is not set');
  }

  const sandboxName = `git-ts-${runId}`;

  // Initialize Daytona client
  const daytona = new Daytona({
    apiKey: apiKey,
    apiUrl: 'REDACTED'
  });

  let sandbox: any;
  try {
    // Create sandbox
    console.log(`Creating sandbox: ${sandboxName}`);
    sandbox = await daytona.create({
      name: sandboxName
    });

    // Clone repository
    console.log('Cloning repository...');
    await sandbox.git.clone(
      'https://github.com/octocat/Spoon-Knife',
      '/home/daytona/spoon-knife'
    );

    // Get git status
    console.log('Getting git status...');
    const status = await sandbox.git.status('/home/daytona/spoon-knife');
    const branchName = status.currentBranch;

    // List files
    console.log('Listing files...');
    const lsResult = await sandbox.process.executeCommand('ls /home/daytona/spoon-knife');
    const filesOutput = lsResult.result;
    const files = filesOutput.trim().split(/\s+/).filter((f: string) => f.length > 0);
    const fileList = files.join(', ');

    // Write to log file
    const logPath = '/home/user/myproject/output.log';
    const logContent = `Branch: ${branchName}\nFiles: ${fileList}\n`;
    fs.writeFileSync(logPath, logContent);

    console.log(`Log file written to: ${logPath}`);
    console.log(`Branch: ${branchName}`);
    console.log(`Files: ${fileList}`);
  } finally {
    // Delete sandbox
    if (sandbox) {
      console.log(`Deleting sandbox: ${sandboxName}`);
      await daytona.delete(sandbox);
    }
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});