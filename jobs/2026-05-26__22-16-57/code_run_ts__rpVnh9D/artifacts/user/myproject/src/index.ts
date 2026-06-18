import { Daytona } from '@daytonaio/sdk';
import * as fs from 'fs';
import * as path from 'path';

async function main(): Promise<void> {
  // Read environment variables
  const zealtRunId = process.env.ZEALT_RUN_ID;
  const apiKey = process.env.DAYTONA_API_KEY;

  if (!zealtRunId) {
    console.error('Error: ZEALT_RUN_ID environment variable is not set');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('Error: DAYTONA_API_KEY environment variable is not set');
    process.exit(1);
  }

  const sandboxName = `code-run-ts-${zealtRunId}`;
  console.log(`Creating sandbox: ${sandboxName}`);

  let sandbox: any = null;

  try {
    // Initialize Daytona SDK
    const daytona = new Daytona({ apiKey });

    // Create sandbox with TypeScript language
    sandbox = await daytona.create({
      language: 'typescript',
      labels: {
        name: sandboxName,
      },
    });

    console.log(`Sandbox created with ID: ${sandbox.id}`);

    // Execute factorial computation
    const snippet = `
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

const result = factorial(6);
console.log(result);
`;

    console.log('Executing factorial computation...');
    const response = await sandbox.process.codeRun(snippet);

    // Check for errors
    if (response.exitCode !== 0) {
      console.error(`Code execution failed with exit code: ${response.exitCode}`);
      process.exit(1);
    }

    // Extract result and trim whitespace
    const result = response.result?.trim();
    if (!result) {
      console.error('Error: No result captured from code execution');
      process.exit(1);
    }

    const factorialValue = parseInt(result, 10);
    if (isNaN(factorialValue)) {
      console.error(`Error: Result is not a valid number: ${result}`);
      process.exit(1);
    }

    console.log(`Factorial result: ${factorialValue}`);

    // Write result to log file
    const logFilePath = path.join(__dirname, '..', 'output.log');
    const logLine = `Factorial: ${factorialValue}`;
    fs.writeFileSync(logFilePath, logLine, 'utf-8');
    console.log(`Result written to: ${logFilePath}`);

    // Delete sandbox
    console.log('Deleting sandbox...');
    await daytona.delete(sandbox);
    console.log('Sandbox deleted successfully');

  } catch (error) {
    console.error('Error during execution:', error);

    // Attempt to clean up sandbox if it was created
    if (sandbox) {
      try {
        console.log('Attempting to clean up sandbox...');
        const daytona = new Daytona({ apiKey });
        await daytona.delete(sandbox);
        console.log('Sandbox cleaned up successfully');
      } catch (cleanupError) {
        console.error('Failed to clean up sandbox:', cleanupError);
      }
    }

    process.exit(1);
  }
}

main();