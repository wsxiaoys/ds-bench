import { Daytona } from '@daytonaio/sdk';
import * as fs from 'node:fs/promises';

async function main() {
  const runId = (await fs.readFile('/logs/artifacts/run-id', 'utf8')).trim();
  const sandboxName = `code-run-ts-${runId}-sdk-test`;

  const daytona = new Daytona();
  // Just create sandbox, then immediately delete
  const sandbox = await daytona.create({ name: sandboxName, language: 'typescript' });
  console.log('Created sandbox');
  await daytona.delete(sandbox);
  console.log('Deleted sandbox');
}
main().catch(console.error);
