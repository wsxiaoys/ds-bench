import { readFile, appendFile } from 'node:fs/promises';
import { Daytona } from '@daytona/sdk';

const LOG_FILE = '/home/user/myproject/output.log';
const RUN_ID_FILE = '/logs/artifacts/run-id';

async function main() {
  // 1. Read the run-id from the local artifacts file.
  const runId = (await readFile(RUN_ID_FILE, 'utf8')).trim();
  const sandboxName = `exec-ts-${runId}`;
  console.log(`Run ID: ${runId}`);
  console.log(`Sandbox name: ${sandboxName}`);

  // Authenticate via the DAYTONA_API_KEY environment variable (read REDACTEDmatically).
  const daytona = new Daytona();

  let sandbox;
  try {
    // 2. Create a new sandbox, passing the run-id into the sandbox environment.
    sandbox = await daytona.create({
      name: sandboxName,
      language: 'typescript',
      envVars: { RUN_ID: runId },
    });
    console.log(`Created sandbox ${sandbox.id} (${sandboxName})`);

    // 3. Run `cat /etc/os-release` and record the captured stdout.
    const osRes = await sandbox.process.executeCommand('cat /etc/os-release');
    await appendLabeled(LOG_FILE, 'OS', osRes.result);
    console.log('Captured /etc/os-release');

    // 4. Run `node --version` and record the captured stdout.
    const nodeRes = await sandbox.process.executeCommand('node --version');
    await appendLabeled(LOG_FILE, 'NODE', nodeRes.result);
    console.log('Captured node --version');

    // 5. Run `echo <run-id>` (via the RUN_ID env var) and record the captured stdout.
    const echoRes = await sandbox.process.executeCommand('echo $RUN_ID', undefined, { RUN_ID: runId });
    await appendLabeled(LOG_FILE, 'ECHO', echoRes.result);
    console.log('Captured echo');
  } finally {
    // 6. Always tear the sandbox down before exiting.
    if (sandbox) {
      try {
        await daytona.delete(sandbox);
        console.log(`Deleted sandbox ${sandboxName}`);
      } catch (err) {
        console.error('Failed to delete sandbox:', err);
      }
    }
  }
}

/**
 * Append a captured payload to the log file, prefixing every line of the
 * payload with the required label so each captured output is preserved on its
 * own labeled line(s).
 */
async function appendLabeled(file, label, payload) {
  const text = String(payload ?? '').replace(/\r\n/g, '\n').replace(/\s+$/, '');
  const lines = text.length ? text.split('\n') : [''];
  const block = lines.map((line) => `${label}: ${line}`).join('\n') + '\n';
  await appendFile(file, block, 'utf8');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});