import { Daytona } from '@daytonaio/sdk';
import * as fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import * as path from 'node:path';

const RUN_ID_FILE = '/logs/artifacts/run-id';
const OUTPUT_LOG_FILE = path.join('/home/user/myproject', 'output.log');

async function readRunId(): Promise<string> {
  const raw = await fs.readFile(RUN_ID_FILE, 'utf8');
  return raw.trim();
}

async function main(): Promise<void> {
  const runId = await readRunId();
  const sandboxName = `code-run-ts-${runId}`;
  const outputLogPath = OUTPUT_LOG_FILE;

  const daytona = new Daytona();

  let sandbox: Awaited<ReturnType<Daytona['create']>> | undefined;
  try {
    sandbox = await daytona.create({
      name: sandboxName,
      language: 'typescript',
    });

    const snippet = `
const factorial = (n: number): number => {
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
};

console.log(factorial(6));
`;

    const response = await sandbox.process.codeRun(snippet);

    if (response.exitCode !== 0) {
      console.error(
        `codeRun exited with non-zero exitCode=${response.exitCode}; stderr=${response.result}`,
      );
      process.exitCode = response.exitCode || 1;
      return;
    }

    const captured = (response.result ?? '').trim();
    const outputLine = `Factorial: ${captured}\n`;
    writeFileSync(outputLogPath, outputLine, 'utf8');
  } finally {
    if (sandbox) {
      try {
        await daytona.delete(sandbox);
        console.log(`Deleted sandbox ${sandboxName}`);
      } catch (cleanupErr) {
        console.error(`Failed to delete sandbox ${sandboxName}:`, cleanupErr);
      }
    }
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});