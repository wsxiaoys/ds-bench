import { Daytona } from '@daytonaio/sdk';
import * as fs from 'fs';

async function main() {
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error('ZEALT_RUN_ID is not set');
  }

  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error('DAYTONA_API_KEY is not set');
  }

  const daytona = new Daytona({
    apiKey,
    serverUrl: 'REDACTED',
  });

  const sandboxName = `git-ts-${runId}`;
  let sandbox;

  try {
    sandbox = await daytona.create({
      name: sandboxName,
      image: 'ubuntu:22.04'
    });

    try {
      await sandbox.waitUntilStarted();
    } catch (e) {
      console.log('waitUntilStarted error or already started', e);
    }

    const clonePath = '/home/daytona/spoon-knife';
    await sandbox.process.executeCommand('mkdir -p /home/daytona');
    await sandbox.git.clone('https://github.com/octocat/Spoon-Knife', clonePath);

    const status = await sandbox.git.status(clonePath);
    const branchName = status.currentBranch;

    const lsResponse = await sandbox.process.executeCommand(`ls ${clonePath}`);
    const filesText = lsResponse.result || '';
    const files = filesText.split(/\s+/).filter(f => f.trim().length > 0);
    const filesCsv = files.join(', ');

    const outputLog = '/home/user/myproject/output.log';
    fs.writeFileSync(outputLog, `Branch: ${branchName}\nFiles: ${filesCsv}\n`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    if (sandbox) {
      try {
        await daytona.delete(sandbox);
      } catch (delErr) {
        console.error('Error deleting sandbox:', delErr);
      }
    }
  }
}

main();
