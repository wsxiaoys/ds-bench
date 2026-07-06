import { Daytona } from '@daytonaio/sdk';
import * as fs from 'fs';

async function main() {
  const runIdPath = '/logs/artifacts/run-id';
  if (!fs.existsSync(runIdPath)) {
    console.error(`Run ID file not found at ${runIdPath}`);
    process.exit(1);
  }
  const runId = fs.readFileSync(runIdPath, 'utf8').trim();
  const sandboxName = `code-run-ts-${runId}`;
  console.log(`Using Sandbox name/label: ${sandboxName}`);

  const daytona = new Daytona();
  let sandbox;

  try {
    console.log('Creating sandbox...');
    sandbox = await daytona.create({
      language: 'typescript',
      name: sandboxName,
      labels: {
        name: sandboxName,
      },
    });
    console.log(`Sandbox created successfully with ID: ${sandbox.id}`);

    const snippet = `
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
console.log(factorial(6));
    `.trim();

    console.log('Running code snippet in sandbox...');
    const response = await sandbox.process.codeRun(snippet);

    if (response.exitCode !== 0) {
      console.error(`Code execution failed with exit code: ${response.exitCode}`);
      console.error(response.result);
      process.exit(response.exitCode || 1);
    }

    const rawResult = response.result;
    console.log('Raw result from codeRun:', rawResult);

    // Extract the integer from the output (e.g. 720)
    const lines = rawResult.split('\n').map(l => l.trim());
    const integerLine = lines.find(l => /^\d+$/.test(l));

    if (!integerLine) {
      console.error('Could not find a numeric result in the output!');
      process.exit(1);
    }

    console.log(`Extracted numeric result: ${integerLine}`);

    const outputLogPath = '/home/user/myproject/output.log';
    fs.writeFileSync(outputLogPath, `Factorial: ${integerLine}\n`, 'utf8');
    console.log(`Result successfully written to ${outputLogPath}`);

  } catch (error) {
    console.error('An error occurred during sandbox execution:', error);
    process.exit(1);
  } finally {
    if (sandbox) {
      console.log('Cleaning up: deleting sandbox...');
      try {
        await daytona.delete(sandbox);
        console.log('Sandbox deleted successfully.');
      } catch (deleteError) {
        console.error('Failed to delete sandbox:', deleteError);
      }
    }
  }
}

main().catch((err) => {
  console.error('Unhandled error in main:', err);
  process.exit(1);
});
