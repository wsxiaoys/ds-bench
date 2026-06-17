import { Daytona, Image } from '@daytonaio/sdk';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error('DAYTONA_API_KEY is not set');
  }

  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error('ZEALT_RUN_ID is not set');
  }

  const daytona = new Daytona({ apiKey });
  const sandboxName = `decl-ts-${runId}`;

  const image = Image.debianSlim('3.12').pipInstall(['flask', 'click']);

  console.log(`Creating sandbox ${sandboxName}...`);
  const sandbox = await daytona.create({
    image,
    name: sandboxName,
  }, {
    timeout: 0,
  });

  try {
    console.log(`Executing command...`);
    const cmd = `python3 -c "import flask, click; print('flask', flask.__version__); print('click', click.__version__)"`;
    const response = await sandbox.process.executeCommand(cmd);

    // According to the hint: "read its `.result` (stdout) field"
    // I need to check the exact property name on response. Is it `result` or `code` etc?
    // Let me verify the SDK process.executeCommand return type.
    const output = response.result;
    console.log(`Output: ${output}`);

    const filteredOutput = output
      .split('\n')
      .filter(line => line.startsWith('flask ') || line.startsWith('click '))
      .join('\n');

    const logPath = path.join(__dirname, 'output.log');
    fs.writeFileSync(logPath, filteredOutput + '\n');
    console.log(`Wrote output to ${logPath}`);
  } finally {
    console.log(`Deleting sandbox ${sandboxName}...`);
    await daytona.delete(sandbox);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
