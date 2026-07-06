import { Daytona } from '@daytonaio/sdk';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // 1. Read run-id and create a sandbox whose name is git-ts-${run-id}
  const runIdPath = '/logs/artifacts/run-id';
  const runId = fs.readFileSync(runIdPath, 'utf8').trim();
  const sandboxName = `git-ts-${runId}`;

  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY!,
    serverUrl: 'https://app.daytona.io/api',
  });

  const sandbox = await daytona.create({
    name: sandboxName,
  });

  try {
    const clonePath = '/home/daytona/spoon-knife';
    const repoUrl = 'https://github.com/octocat/Spoon-Knife';

    // 2. Clone the repository
    await sandbox.git.clone(repoUrl, clonePath);

    // 3. Get the current branch from git.status
    const status = await sandbox.git.status(clonePath);
    const branchName = status.currentBranch;

    // 4. List files at the root of the cloned repo
    const lsResult = await sandbox.process.executeCommand(
      `ls /home/daytona/spoon-knife`,
    );
    const stdout = (lsResult.result ?? '') as string;
    const fileList = stdout
      .split(/\s+|\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const filesValue = fileList.join(', ');

    // 5. Write the branch name and file list to the log file on the host
    const logPath = '/home/user/myproject/output.log';
    const logContent = `Branch: ${branchName}\nFiles: ${filesValue}\n`;
    fs.writeFileSync(logPath, logContent, 'utf8');

    console.log('Branch:', branchName);
    console.log('Files:', filesValue);
    console.log('Wrote log to', logPath);
  } finally {
    // 6. Delete the sandbox regardless of success/failure
    try {
      await sandbox.delete();
    } catch (e) {
      console.error('Failed to delete sandbox:', e);
    }
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
