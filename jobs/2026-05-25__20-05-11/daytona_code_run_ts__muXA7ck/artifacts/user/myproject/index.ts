import { Daytona } from '@daytonaio/sdk';
import * as fs from 'fs';

async function run() {
  const ZEALT_RUN_ID = process.env.ZEALT_RUN_ID;
  if (!ZEALT_RUN_ID) {
    throw new Error('ZEALT_RUN_ID environment variable is required');
  }

  const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY;
  if (!DAYTONA_API_KEY) {
    throw new Error('DAYTONA_API_KEY environment variable is required');
  }

  const daytona = new Daytona({
    apiKey: DAYTONA_API_KEY,
  });

  const sandboxName = `code-run-ts-${ZEALT_RUN_ID}`;
  let sandbox: any = null;

  try {
    console.log(`Creating sandbox: ${sandboxName}`);
    sandbox = await daytona.create({
      language: 'typescript',
      name: sandboxName,
      labels: {
        'zealt-run-id': ZEALT_RUN_ID
      }
    });

    const snippet = `
function factorial(n: number): number {
  if (n === 0 || n === 1) return 1;
  return n * factorial(n - 1);
}
console.log(factorial(6));
    `;

    console.log('Running code snippet...');
    const response = await sandbox.process.codeRun(snippet);

    if (response.exitCode !== 0) {
      console.error(`Code execution failed with exit code ${response.exitCode}`);
      console.error(`Stderr: ${response.stderr}`);
      throw new Error(`Code execution failed with exit code ${response.exitCode}`);
    }

    let result = response.result.trim();
    // Extract the first line to avoid any potential extra output noise
    result = result.split('\n')[0].trim();
    console.log(`Captured result: ${result}`);

    const logPath = '/home/user/myproject/output.log';
    fs.writeFileSync(logPath, `Factorial: ${result}\n`);
    console.log(`Result written to ${logPath}`);

  } finally {
    if (sandbox) {
      try {
        console.log('Deleting sandbox...');
        await daytona.delete(sandbox);
      } catch (deleteError) {
        console.error('Failed to delete sandbox:', deleteError);
      }
    }
  }
}

run().catch(error => {
  console.error('An error occurred:', error);
  process.exit(1);
});
