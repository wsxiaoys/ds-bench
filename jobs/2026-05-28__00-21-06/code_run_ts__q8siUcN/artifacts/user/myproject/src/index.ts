import * as fs from 'fs';
import * as path from 'path';
import { Daytona } from '@daytonaio/sdk';

async function main(): Promise<void> {
  // Read required environment variables
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error('DAYTONA_API_KEY environment variable is required');
  }

  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error('ZEALT_RUN_ID environment variable is required');
  }

  const sandboxName = `code-run-ts-${runId}`;
  const logFilePath = path.resolve(__dirname, '..', 'output.log');

  console.log(`Creating sandbox with name: ${sandboxName}`);

  // Initialize the Daytona client using the API key from the environment
  const daytona = new Daytona({ apiKey });

  let sandbox: Awaited<ReturnType<typeof daytona.create>> | null = null;

  try {
    // Create a sandbox with TypeScript language and a recognisable name via labels
    sandbox = await daytona.create(
      {
        language: 'typescript',
        name: sandboxName,
        labels: {
          name: sandboxName,
        },
      },
      { timeout: 120 }
    );

    console.log(`Sandbox created: ${sandbox.id}`);

    // TypeScript snippet that computes 6! and prints the result
    const snippet = `
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
console.log(factorial(6));
`;

    console.log('Running factorial snippet in sandbox...');
    const response = await sandbox.process.codeRun(snippet);

    if (response.exitCode !== 0) {
      throw new Error(
        `Code execution failed with exit code ${response.exitCode}. Output: ${response.result}`
      );
    }

    // Extract the first meaningful line of output, ignoring npm notices
    // that the sandbox runtime may append after the snippet's stdout.
    const factorialValue = response.result
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith('npm '));
    if (!factorialValue) {
      throw new Error(`No output captured from code execution. Raw output: ${response.result}`);
    }

    console.log(`Factorial result: ${factorialValue}`);

    // Write result to the log file
    const logLine = `Factorial: ${factorialValue}\n`;
    fs.writeFileSync(logFilePath, logLine, 'utf8');
    console.log(`Result written to ${logFilePath}`);
  } finally {
    // Always delete the sandbox, even on failure
    if (sandbox !== null) {
      console.log(`Deleting sandbox: ${sandbox.id}`);
      try {
        await daytona.delete(sandbox);
        console.log('Sandbox deleted successfully.');
      } catch (deleteErr) {
        console.error('Failed to delete sandbox:', deleteErr);
      }
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
