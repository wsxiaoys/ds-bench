import fs from 'fs';
import { Daytona } from '@daytona/sdk';

async function main() {
  const runId = fs.readFileSync('/logs/artifacts/run-id', 'utf-8').trim();
  const sandboxName = `exec-ts-${runId}`;
  console.log(`Read run ID: ${runId}`);
  console.log(`Target sandbox name: ${sandboxName}`);

  const daytona = new Daytona();
  let sandbox;

  try {
    console.log('Creating sandbox...');
    sandbox = await daytona.create({
      name: sandboxName,
      envVars: {
        RUN_ID: runId
      }
    });
    console.log(`Sandbox created successfully. ID: ${sandbox.id}`);

    // Clear or initialize the output log file
    const logPath = '/home/user/myproject/output.log';
    fs.writeFileSync(logPath, '');

    // Helper to append log
    const appendLog = (prefix, content) => {
      const lines = content.trim().split('\n');
      for (const line of lines) {
        fs.appendFileSync(logPath, `${prefix}${line}\n`);
      }
    };

    // 1. Run cat /etc/os-release
    console.log('Running cat /etc/os-release...');
    const osResponse = await sandbox.process.executeCommand('cat /etc/os-release');
    console.log('OS Release exit code:', osResponse.exitCode);
    appendLog('OS: ', osResponse.result);

    // 2. Run node --version
    console.log('Running node --version...');
    const nodeResponse = await sandbox.process.executeCommand('node --version');
    console.log('Node version exit code:', nodeResponse.exitCode);
    appendLog('NODE: ', nodeResponse.result);

    // 3. Run echo $RUN_ID
    console.log('Running echo $RUN_ID...');
    const echoResponse = await sandbox.process.executeCommand('echo $RUN_ID');
    console.log('Echo exit code:', echoResponse.exitCode);
    appendLog('ECHO: ', echoResponse.result);

    console.log('All commands executed and logged successfully.');
  } catch (error) {
    console.error('An error occurred during execution:', error);
    throw error;
  } finally {
    if (sandbox) {
      console.log('Deleting sandbox...');
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
  console.error('Fatal error in main process:', err);
  process.exit(1);
});
