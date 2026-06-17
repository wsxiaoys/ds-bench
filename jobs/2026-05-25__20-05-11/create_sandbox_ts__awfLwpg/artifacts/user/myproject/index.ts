import { Daytona } from '@daytonaio/sdk';
import fs from 'fs';
import path from 'path';

async function main() {
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    console.error('ZEALT_RUN_ID environment variable is not set');
    process.exit(1);
  }

  const daytona = new Daytona();
  const sandboxName = `create-sandbox-ts-${runId}`;

  try {
    console.log(`Creating sandbox: ${sandboxName}`);
    const sandbox = await daytona.create({
      name: sandboxName,
      language: 'typescript'
    });

    console.log(`Sandbox created with ID: ${sandbox.id}`);

    const logFilePath = '/home/user/myproject/output.log';
    const logContent = `Sandbox ID: ${sandbox.id}\n`;
    
    fs.writeFileSync(logFilePath, logContent);
    console.log(`Logged sandbox ID to ${logFilePath}`);

    console.log(`Deleting sandbox: ${sandbox.id}`);
    await daytona.delete(sandbox);
    console.log('Sandbox deleted successfully');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
