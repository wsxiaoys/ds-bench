import { Daytona, Image } from '@daytonaio/sdk';
import * as fs from 'fs';
import * as path from 'path';

async function main(): Promise<void> {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error('DAYTONA_API_KEY environment variable is not set');
  }

  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error('ZEALT_RUN_ID environment variable is not set');
  }

  const sandboxName = `decl-ts-${runId}`;

  // Build the declarative image: Debian Slim with Python 3.12, flask and click installed
  const image = Image.debianSlim('3.12').pipInstall(['flask', 'click']);

  // Initialize the Daytona SDK (uses default API URL: REDACTED)
  const daytona = new Daytona({ apiKey });

  let sandbox: Awaited<ReturnType<typeof daytona.create>> | null = null;

  try {
    console.log(`Creating sandbox "${sandboxName}" from declarative image...`);
    sandbox = await daytona.create(
      {
        name: sandboxName,
        image,
      },
      {
        timeout: 0,
        onSnapshotCreateLogs: (chunk: string) => process.stdout.write(chunk),
      }
    );
    console.log(`Sandbox "${sandboxName}" created successfully.`);

    // Run Python command inside the sandbox to print flask and click versions
    const cmd = `python3 -c "import flask, click; print('flask', flask.__version__); print('click', click.__version__)"`;
    console.log('Executing command in sandbox...');
    const execResult = await sandbox.process.executeCommand(cmd);

    const rawOutput: string = execResult.result;
    console.log('Raw command output:', rawOutput);

    // Extract only the flask and click version lines (filter out deprecation warnings)
    const lines = rawOutput.split('\n');
    const versionLines = lines.filter(
      (line) => line.startsWith('flask ') || line.startsWith('click ')
    );
    const output = versionLines.join('\n') + '\n';
    console.log('Filtered output:', output);

    // Write the filtered output to the log file on the host
    const logPath = path.join('/home/user/myproject', 'output.log');
    fs.writeFileSync(logPath, output, 'utf-8');
    console.log(`Output written to ${logPath}`);
  } finally {
    // Always delete the sandbox, even on errors
    if (sandbox !== null) {
      console.log(`Deleting sandbox "${sandboxName}"...`);
      await daytona.delete(sandbox);
      console.log(`Sandbox "${sandboxName}" deleted.`);
    }
  }
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
