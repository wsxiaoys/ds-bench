import * as fs from 'fs';
import * as path from 'path';
import { Daytona } from '@daytonaio/sdk';

async function main(): Promise<void> {
  // Step 1: Read run-id from environment and build the sandbox name
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error('ZEALT_RUN_ID environment variable is not set');
  }
  const sandboxName = `git-ts-${runId}`;

  // Validate API key presence early
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error('DAYTONA_API_KEY environment variable is not set');
  }

  // Configure the Daytona client
  const daytona = new Daytona({
    apiKey,
    apiUrl: 'REDACTED',
  });

  const clonePath = '/home/daytona/spoon-knife';
  const repoUrl = 'https://github.com/octocat/Spoon-Knife';
  const logFilePath = path.resolve('/home/user/myproject/output.log');

  // Create the sandbox
  console.log(`Creating sandbox: ${sandboxName}`);
  const sandbox = await daytona.create({ name: sandboxName });
  console.log(`Sandbox created with id: ${sandbox.id}`);

  try {
    // Step 2: Clone the repository into the sandbox
    console.log(`Cloning ${repoUrl} into ${clonePath} ...`);
    await sandbox.git.clone(repoUrl, clonePath);
    console.log('Clone completed.');

    // Step 3: Get the git status to retrieve the current branch name
    console.log('Fetching git status ...');
    const gitStatus = await sandbox.git.status(clonePath);
    const branchName = gitStatus.currentBranch ?? 'unknown';
    console.log(`Current branch: ${branchName}`);

    // Step 4: List the files at the root of the cloned repository
    console.log('Listing files in cloned repository ...');
    const lsResponse = await sandbox.process.executeCommand(`ls ${clonePath}`);
    const rawOutput: string = lsResponse.result ?? '';
    const files = rawOutput
      .split(/\s+/)
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
    const fileList = files.join(', ');
    console.log(`Files: ${fileList}`);

    // Step 5: Write results to the log file on the host machine
    const logContent = `Branch: ${branchName}\nFiles: ${fileList}\n`;
    fs.writeFileSync(logFilePath, logContent, 'utf8');
    console.log(`Results written to ${logFilePath}`);
  } finally {
    // Step 6: Delete the sandbox regardless of success or failure
    console.log(`Deleting sandbox: ${sandboxName}`);
    await daytona.delete(sandbox);
    console.log('Sandbox deleted.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
