import { Daytona } from '@daytonaio/sdk';
import * as fs from 'fs';

async function run() {
  const runId = process.env.ZEALT_RUN_ID;
  const apiKey = process.env.DAYTONA_API_KEY;
  const apiUrl = 'REDACTED';
  const logFilePath = '/home/user/myproject/output.log';

  if (!runId) {
    console.error('ZEALT_RUN_ID is not set');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('DAYTONA_API_KEY is not set');
    process.exit(1);
  }

  const daytona = new Daytona({
    apiKey: apiKey,
    apiUrl: apiUrl,
  });

  const sandboxName = `git-ts-${runId}`;
  let sandbox: any = null;

  try {
    console.log(`Creating sandbox: ${sandboxName}`);
    // Using create instead of createSandbox
    sandbox = await daytona.create({
      name: sandboxName,
    });

    const targetPath = '/home/daytona/spoon-knife';
    console.log(`Cloning repository into ${targetPath}`);
    await sandbox.git.clone('https://github.com/octocat/Spoon-Knife', targetPath);

    console.log('Getting git status');
    const status = await sandbox.git.status(targetPath);
    const branchName = status.currentBranch;

    console.log('Listing files');
    const execResult = await sandbox.process.executeCommand(`ls ${targetPath}`);
    const files = execResult.result
      .split(/\s+/)
      .map((f: string) => f.trim())
      .filter((f: string) => f.length > 0)
      .join(', ');

    const logContent = `Branch: ${branchName}\nFiles: ${files}\n`;
    fs.writeFileSync(logFilePath, logContent);
    console.log('Log file written successfully');

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    if (sandbox) {
      try {
        console.log(`Deleting sandbox: ${sandboxName}`);
        // Using sandbox.delete() instead of daytona.removeSandbox()
        await sandbox.delete();
        console.log('Sandbox deleted');
      } catch (deleteError) {
        console.error('Failed to delete sandbox:', deleteError);
      }
    }
  }
}

run();
