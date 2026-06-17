import { Daytona } from '@daytona/sdk';
import * as fs from 'fs';
import * as process from 'process';

async function main() {
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    console.error('ZEALT_RUN_ID is not set');
    process.exit(1);
  }

  const daytona = new Daytona();
  const sandboxName = `exec-ts-${runId}`;
  const logFile = '/home/user/myproject/output.log';

  let sandbox;
  try {
    console.log(`Creating sandbox: ${sandboxName}`);
    sandbox = await daytona.create({
      name: sandboxName,
      envVars: {
        ZEALT_RUN_ID: runId,
      },
    });

    console.log('Executing cat /etc/os-release');
    const osRelease = await sandbox.process.executeCommand('cat /etc/os-release');
    fs.appendFileSync(logFile, `OS: ${osRelease.result}\n`);

    console.log('Executing node --version');
    const nodeVersion = await sandbox.process.executeCommand('node --version');
    fs.appendFileSync(logFile, `NODE: ${nodeVersion.result}\n`);

    console.log('Executing echo ${ZEALT_RUN_ID}');
    const echoRunId = await sandbox.process.executeCommand('echo ${ZEALT_RUN_ID}');
    fs.appendFileSync(logFile, `ECHO: ${echoRunId.result}\n`);

  } catch (error) {
    console.error('Error during execution:', error);
  } finally {
    if (sandbox) {
      console.log(`Deleting sandbox: ${sandboxName}`);
      try {
        await daytona.delete(sandbox);
      } catch (deleteError) {
        console.error('Error deleting sandbox:', deleteError);
      }
    }
  }
}

main();
