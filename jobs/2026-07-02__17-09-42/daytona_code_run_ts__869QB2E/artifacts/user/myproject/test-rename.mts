import { Daytona } from '@daytonaio/sdk';
import * as fs from 'node:fs/promises';

async function main() {
  const runId = (await fs.readFile('/logs/artifacts/run-id', 'utf8')).trim();
  const sandboxName = `code-run-ts-${runId}`;
  const tempPath = '/tmp/output-test-temp.log';
  const finalPath = '/home/user/myproject/output.log';

  const daytona = new Daytona();
  let sandbox;
  try {
    sandbox = await daytona.create({ name: sandboxName, language: 'typescript' });
    const snippet = `console.log((()=>{let r=1;for(let i=2;i<=6;i++)r*=i;return r;})());`;
    const response = await sandbox.process.codeRun(snippet);
    if (response.exitCode !== 0) { process.exitCode = response.exitCode || 1; return; }
    const captured = (response.result ?? '').trim();
    // Write to temp first, then rename
    await fs.writeFile(tempPath, `Factorial: ${captured}\n`, 'utf8');
    await fs.rename(tempPath, finalPath);
    console.log(`Wrote Factorial: ${captured} to ${finalPath}`);
  } finally {
    if (sandbox) await daytona.delete(sandbox);
  }
}
main().catch((err) => { console.error('Error:', err); process.exit(1); });
