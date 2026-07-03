const fs = require('fs');
const path = require('path');
const { Daytona } = require('@daytona/sdk');

async function main() {
  // Read run-id
  const runId = fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();
  console.log(`Using run-id: ${runId}`);

  const sandboxName = `exec-ts-${runId}`;
  const logPath = '/home/user/myproject/output.log';

  // Ensure output log file exists (truncate to start fresh)
  fs.writeFileSync(logPath, '');

  // Create the Daytona SDK client (uses DAYTONA_API_KEY env var REDACTEDmatically)
  const daytona = new Daytona();

  let sandbox = null;
  try {
    // Create a sandbox, passing the run-id as an env var
    sandbox = await daytona.create({
      name: sandboxName,
      envVars: {
        RUN_ID: runId,
      },
    });
    console.log(`Sandbox created: ${sandbox.id} (name=${sandboxName})`);

    // 1. cat /etc/os-release
    const osResp = await sandbox.process.executeCommand('cat /etc/os-release');
    const osOut = osResp.result != null ? osResp.result : (osResp.artifacts && osResp.artifacts.stdout) || '';
    console.log('OS release captured');
    fs.appendFileSync(logPath, `OS: ${osOut}`);
    if (!osOut.endsWith('\n')) fs.appendFileSync(logPath, '\n');

    // 2. node --version
    const nodeResp = await sandbox.process.executeCommand('node --version');
    const nodeOut = nodeResp.result != null ? nodeResp.result : (nodeResp.artifacts && nodeResp.artifacts.stdout) || '';
    console.log('Node version captured');
    fs.appendFileSync(logPath, `NODE: ${nodeOut}`);
    if (!nodeOut.endsWith('\n')) fs.appendFileSync(logPath, '\n');

    // 3. echo <run-id>
    const echoResp = await sandbox.process.executeCommand(`echo ${runId}`);
    const echoOut = echoResp.result != null ? echoResp.result : (echoResp.artifacts && echoResp.artifacts.stdout) || '';
    console.log('Echo captured');
    fs.appendFileSync(logPath, `ECHO: ${echoOut}`);
    if (!echoOut.endsWith('\n')) fs.appendFileSync(logPath, '\n');

    console.log('All commands executed. Results written to output.log');
  } catch (err) {
    console.error('Error during execution:', err);
    process.exitCode = 1;
  } finally {
    if (sandbox) {
      try {
        console.log('Deleting sandbox...');
        await daytona.delete(sandbox);
        console.log('Sandbox deleted');
      } catch (e) {
        console.error('Failed to delete sandbox:', e && e.message ? e.message : e);
      }
    }
  }
}

main();
