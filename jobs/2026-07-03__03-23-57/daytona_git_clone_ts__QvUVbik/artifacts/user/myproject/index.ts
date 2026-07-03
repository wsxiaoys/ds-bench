import { Daytona } from '@daytonaio/sdk';
import * as fs from 'fs';

async function main() {
  const runId = fs.readFileSync('/logs/artifacts/run-id', 'utf-8').trim();
  console.log('Read Run ID:', runId);

  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: 'https://app.daytona.io/api',
    serverUrl: 'https://app.daytona.io/api',
  });

  let sandbox: any = null;
  try {
    console.log('Creating sandbox...');
    sandbox = await daytona.create({
      name: `git-ts-${runId}`,
    });
    console.log('Sandbox created:', sandbox.id, sandbox.name);

    console.log('Cloning repository...');
    await sandbox.git.clone('https://github.com/octocat/Spoon-Knife', '/home/daytona/spoon-knife');
    console.log('Repository cloned.');

    console.log('Getting repository status...');
    const status = await sandbox.git.status('/home/daytona/spoon-knife');
    const branchName = status.currentBranch;
    console.log('Branch name:', branchName);

    console.log('Listing files...');
    const cmdRes = await sandbox.process.executeCommand('ls /home/daytona/spoon-knife');
    console.log('Command exit code:', cmdRes.exitCode);
    console.log('Command stdout:', cmdRes.result);

    const filesList = cmdRes.result
      .split(/\s+/)
      .map(f => f.trim())
      .filter(f => f.length > 0);

    const filesStr = filesList.join(', ');
    console.log('Files list:', filesStr);

    const logContent = `Branch: ${branchName}\nFiles: ${filesStr}\n`;
    fs.writeFileSync('/home/user/myproject/output.log', logContent);
    console.log('Successfully wrote to /home/user/myproject/output.log');

  } catch (error) {
    console.error('Error during execution:', error);
    throw error;
  } finally {
    if (sandbox) {
      console.log('Cleaning up: Deleting sandbox...');
      try {
        await sandbox.delete();
        console.log('Sandbox deleted successfully.');
      } catch (deleteError) {
        console.error('Error deleting sandbox:', deleteError);
      }
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
