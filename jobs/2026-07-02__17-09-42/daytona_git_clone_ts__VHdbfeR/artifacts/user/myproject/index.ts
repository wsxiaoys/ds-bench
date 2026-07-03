import * as fs from 'fs';
import { Daytona } from '@daytonaio/sdk';

const RUN_ID_FILE = '/logs/artifacts/run-id';
const REPO_URL = 'https://github.com/octocat/Spoon-Knife';
const REPO_DIR = '/home/daytona/spoon-knife';
const OUTPUT_LOG = '/home/user/myproject/output.log';
const LS_COMMAND = `ls ${REPO_DIR}`;

async function main(): Promise<void> {
  // 1. Read run-id and create a sandbox with the appropriate name.
  const runId = fs.readFileSync(RUN_ID_FILE, 'utf8').trim();
  const sandboxName = `git-ts-${runId}`;
  console.log(`[info] run-id = ${runId}`);
  console.log(`[info] sandbox name = ${sandboxName}`);

  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    serverUrl: 'https://app.daytona.io/api',
  });

  const sandbox = await daytona.create({
    name: sandboxName,
    language: 'typescript',
  });
  console.log(`[info] sandbox created: id=${sandbox.id}`);

  try {
    // 2. Clone the repository into the absolute path inside the sandbox.
    console.log(`[info] cloning ${REPO_URL} into ${REPO_DIR}`);
    await sandbox.git.clone(REPO_URL, REPO_DIR);

    // 3. Get the current branch of the cloned repo.
    const gitStatus = await sandbox.git.status(REPO_DIR);
    const branchName = gitStatus.currentBranch;
    console.log(`[info] current branch: ${branchName}`);

    // 4. List the files at the root of the cloned repository.
    const lsResult = await sandbox.process.executeCommand(LS_COMMAND);
    const lsStdout = lsResult.result ?? '';
    console.log(`[info] ls stdout: ${JSON.stringify(lsStdout)}`);

    // 5. Build the file list and write the log file on the host.
    const files = lsStdout
      .split(/[\s,]+/)
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    const filesLine = `Files: ${files.join(', ')}`;
    const branchLine = `Branch: ${branchName}`;

    const logContent = `${branchLine}\n${filesLine}\n`;
    fs.writeFileSync(OUTPUT_LOG, logContent);
    console.log(`[info] wrote log to ${OUTPUT_LOG}`);
    console.log(logContent);
  } finally {
    // 6. Delete the sandbox before exiting, regardless of intermediate failures.
    try {
      console.log(`[info] deleting sandbox ${sandbox.id}`);
      await sandbox.delete();
      console.log('[info] sandbox deleted');
    } catch (cleanupErr) {
      console.error(`[warn] failed to delete sandbox: ${cleanupErr}`);
    }
  }
}

main().catch((err) => {
  console.error(`[error] ${err?.stack ?? err}`);
  process.exitCode = 1;
});
