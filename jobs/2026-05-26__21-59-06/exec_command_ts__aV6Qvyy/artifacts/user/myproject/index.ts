import { Daytona } from '@daytona/sdk';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error('ZEALT_RUN_ID is not set');
  }

  const sandboxName = `exec-ts-${runId}`;
  const logFilePath = path.join(__dirname, 'output.log');
  
  const daytona = new Daytona();
  let sandbox;
  try {
    // Create the sandbox
    console.log(`Creating sandbox ${sandboxName}...`);
    sandbox = await daytona.create({
      name: sandboxName,
      image: 'daytonaio/workspace-project:latest',
      envVars: {
        ZEALT_RUN_ID: runId
      }
    });

    console.log(`Sandbox ${sandbox.id} created.`);

    // Run cat /etc/os-release
    console.log('Running cat /etc/os-release...');
    const osResponse = await sandbox.process.executeCommand('cat /etc/os-release');
    fs.appendFileSync(logFilePath, `OS: ${osResponse.result}\n`);

    // Run node --version
    console.log('Running node --version...');
    const nodeResponse = await sandbox.process.executeCommand('node --version');
    fs.appendFileSync(logFilePath, `NODE: ${nodeResponse.result}\n`);

    // Run echo ${ZEALT_RUN_ID}
    console.log('Running echo $ZEALT_RUN_ID...');
    const echoResponse = await sandbox.process.executeCommand('echo $ZEALT_RUN_ID');
    fs.appendFileSync(logFilePath, `ECHO: ${echoResponse.result}\n`);

  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    if (sandbox) {
      console.log(`Deleting sandbox ${sandbox.id}...`);
      await daytona.delete(sandbox);
      console.log('Sandbox deleted.');
    }
  }
}

main().catch(console.error);
