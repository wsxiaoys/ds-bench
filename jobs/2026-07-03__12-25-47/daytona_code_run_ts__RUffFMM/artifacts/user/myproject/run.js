const { Daytona } = require('@daytonaio/sdk');
const fs = require('fs');

async function main() {
  // Read run-id from the file
  const runId = fs.readFileSync('/logs/artifacts/run-id', 'utf-8').trim();
  const sandboxName = `code-run-ts-${runId}`;
  console.log(`Using run-id: ${runId}, sandbox name: ${sandboxName}`);

  const daytona = new Daytona();
  let sandbox = null;
  try {
    // Create the sandbox
    sandbox = await daytona.create({
      name: sandboxName,
      language: 'typescript',
    }, { timeout: 120 });
    console.log(`Sandbox created: ${sandbox.id}`);

    // The code snippet computes factorial of 6
    const snippet = `
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
console.log(factorial(6));
`;

    // Run the snippet
    const response = await sandbox.process.codeRun(snippet);
    console.log(`exitCode: ${response.exitCode}, result: ${JSON.stringify(response.result)}`);

    if (response.exitCode !== 0) {
      console.error(`Code run failed with exitCode ${response.exitCode}`);
      process.exitCode = 1;
      return;
    }

    // Get the result, trim whitespace, then take only the first line (the integer printed by console.log)
    const raw = String(response.result);
    const firstLine = raw.split(/\r?\n/)[0].trim();

    // Write the output to the log file
    const logLine = `Factorial: ${firstLine}\n`;
    fs.writeFileSync('/home/user/myproject/output.log', logLine);
    console.log(`Wrote log line: ${logLine.trim()}`);
  } catch (err) {
    console.error('Error during run:', err);
    process.exitCode = 1;
  } finally {
    // Always delete the sandbox
    if (sandbox) {
      try {
        await daytona.delete(sandbox);
        console.log('Sandbox deleted');
      } catch (delErr) {
        console.error('Failed to delete sandbox:', delErr);
        process.exitCode = 1;
      }
    }
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
