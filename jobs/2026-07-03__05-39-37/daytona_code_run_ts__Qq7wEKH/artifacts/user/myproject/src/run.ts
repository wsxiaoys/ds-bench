import { readFileSync, writeFileSync } from 'node:fs';
import { Daytona } from '@daytonaio/sdk';

/**
 * Reads the run id from /logs/artifacts/run-id, spins up a fresh
 * Daytona sandbox (language: typescript), runs a snippet that computes
 * the factorial of 6 via `sandbox.process.codeRun(...)`, persists the
 * captured stdout to /home/user/myproject/output.log and finally deletes
 * the sandbox — including on failure paths.
 */
async function main(): Promise<void> {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error('DAYTONA_API_KEY environment variable is required');
  }

  // Read the run id (trim trailing whitespace / newlines).
  const runId = readFileSync('/logs/artifacts/run-id', 'utf8').trim();
  if (!runId) {
    throw new Error('Run id file /logs/artifacts/run-id is empty');
  }

  const sandboxName = `code-run-ts-${runId}`;

  const daytona = new Daytona({ apiKey });
  let sandbox;

  try {
    // Create a fresh typescript sandbox, discoverable by its name.
    sandbox = await daytona.create({
      language: 'typescript',
      name: sandboxName,
      labels: { name: sandboxName },
    });

    // Snippet that computes the factorial of 6 and prints the integer.
    // A delimited marker is used so the value can be extracted reliably
    // even if the sandbox runtime emits extra noise (e.g. npm update
    // notices) to stdout alongside the snippet's own console.log output.
    const snippet = `
      function factorial(n) {
        let result = 1;
        for (let i = 2; i <= n; i++) result *= i;
        return result;
      }
      console.log("FACTORIAL_RESULT:" + factorial(6));
    `;

    const response = await sandbox.process.codeRun(snippet);

    // Surface sandbox execution failures cleanly.
    if (response.exitCode !== 0) {
      throw new Error(
        `codeRun exited with code ${response.exitCode}: ${response.result}`,
      );
    }

    // `result` holds the captured stdout from the snippet. Pull out the
    // integer that follows our marker, ignoring any surrounding noise.
    const raw = response.result ?? '';
    const match = raw.match(/FACTORIAL_RESULT:(\d+)/);
    if (!match) {
      throw new Error(
        `Could not find factorial result marker in codeRun output: ${raw}`,
      );
    }
    const value = match[1];

    const logLine = `Factorial: ${value}`;
    writeFileSync('/home/user/myproject/output.log', `${logLine}\n`, 'utf8');
    console.log(logLine);
  } finally {
    // Always clean up the sandbox, even on failure.
    if (sandbox) {
      try {
        await daytona.delete(sandbox);
      } catch (err) {
        // Swallow deletion errors so the original error is preserved.
        console.error('Failed to delete sandbox:', err);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});