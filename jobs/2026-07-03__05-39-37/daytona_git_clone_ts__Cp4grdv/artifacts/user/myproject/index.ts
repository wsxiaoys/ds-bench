import * as fs from 'fs';
import { Daytona } from '@daytonaio/sdk';

const REPO_URL = 'https://github.com/octocat/Spoon-Knife';
const CLONE_PATH = '/home/daytona/spoon-knife';
const RUN_ID_FILE = '/logs/artifacts/run-id';
const LOG_FILE = '/home/user/myproject/output.log';

async function main() {
  // 1. Read run-id and derive sandbox name.
  const runId = fs.readFileSync(RUN_ID_FILE, 'utf8').trim();
  const sandboxName = `git-ts-${runId}`;
  console.log(`Run ID: ${runId}`);
  console.log(`Sandbox name: ${sandboxName}`);

  // Configure the Daytona client against the real Daytona SaaS.
  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    serverUrl: 'https://app.daytona.io/api',
  });

  let sandbox: Awaited<ReturnType<typeof daytona.create>> | undefined;

  try {
    // Create the sandbox.
    console.log('Creating sandbox...');
    sandbox = await daytona.create({ name: sandboxName }, { timeout: 120 });
    console.log(`Sandbox created: ${sandbox.id}`);

    // 2. Clone the public repository into the absolute path inside the sandbox.
    console.log(`Cloning ${REPO_URL} into ${CLONE_PATH} ...`);
    await sandbox.git.clone(REPO_URL, CLONE_PATH);
    console.log('Clone complete.');

    // 3. Get git status and the current branch name.
    console.log('Getting git status...');
    const status = await sandbox.git.status(CLONE_PATH);
    const branchName = status.currentBranch;
    console.log(`Current branch: ${branchName}`);

    // 4. List the files at the root of the cloned repository.
    console.log('Listing files...');
    const lsResult = await sandbox.process.executeCommand('ls /home/daytona/spoon-knife');
    const lsOutput: string = lsResult.result ?? '';
    const files = lsOutput
      .split(/\s+/)
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
    console.log(`Files: ${files.join(', ')}`);

    // 5. Write the branch name and file list to the log file on the host.
    const filesLine = `Files: ${files.join(', ')}`;
    const branchLine = `Branch: ${branchName}`;
    const logContent = `${branchLine}\n${filesLine}\n`;
    fs.writeFileSync(LOG_FILE, logContent, 'utf8');
    console.log(`Log written to ${LOG_FILE}`);
    console.log(logContent);
  } finally {
    // 6. Delete the sandbox before exiting (regardless of success/failure).
    if (sandbox) {
      console.log('Deleting sandbox...');
      try {
        await daytona.delete(sandbox);
        console.log('Sandbox deleted.');
      } catch (err) {
        console.error('Failed to delete sandbox:', err);
      }
    }
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});